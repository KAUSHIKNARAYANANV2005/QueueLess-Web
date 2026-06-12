import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import useAuth from '../../hooks/useAuth';
import {
  Search, MapPin, Phone, Star, Users, Clock,
  AlertTriangle, RefreshCw, Stethoscope, Scissors,
  Sparkles as SpaIcon, Landmark, Building2, Store,
  ArrowRight, Wifi
} from 'lucide-react';

// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'All', label: 'All', icon: Store },
  { value: 'Clinic', label: 'Clinic', icon: Stethoscope },
  { value: 'Salon', label: 'Salon', icon: Scissors },
  { value: 'Spa', label: 'Spa', icon: SpaIcon },
  { value: 'Bank', label: 'Bank', icon: Landmark },
  { value: 'Government Office', label: 'Govt Office', icon: Building2 },
];

const CATEGORY_GRADIENTS = {
  Clinic:             'linear-gradient(135deg, #FF6584 0%, #D63965 100%)',
  Salon:              'linear-gradient(135deg, #FFBD59 0%, #E6930A 100%)',
  Spa:                'linear-gradient(135deg, #00F5D4 0%, #00A896 100%)',
  Bank:               'linear-gradient(135deg, #6C63FF 0%, #4E44E7 100%)',
  'Government Office':'linear-gradient(135deg, #74B9FF 0%, #0984E3 100%)',
};

const getCategoryGradient = (cat) =>
  CATEGORY_GRADIENTS[cat] ?? 'linear-gradient(135deg, #A29BFE 0%, #6C63FF 100%)';

// ─── Star rating renderer ─────────────────────────────────────────────────────
const StarRating = ({ rating = 0 }) => {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.4;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="stars-row" aria-label={`${rating.toFixed(1)} out of 5`}>
      {[...Array(full)].map((_, i) => <Star key={`f${i}`} size={12} fill="#FFBD59" stroke="none" />)}
      {half && <Star key="h" size={12} fill="#FFBD59" stroke="none" style={{ opacity: 0.5 }} />}
      {[...Array(empty)].map((_, i) => <Star key={`e${i}`} size={12} fill="none" stroke="#FFBD59" strokeWidth={1.5} />)}
      <span className="rating-text">{rating.toFixed(1)}</span>
    </span>
  );
};

// ─── Business Card ────────────────────────────────────────────────────────────
const BusinessCard = ({ business, onView }) => {
  const {
    id, name, category, description, address, phone,
    rating = 0, reviewCount = 0, currentQueue = 0,
    isOpen = false, coverImage, logoImage,
  } = business;

  const gradient = getCategoryGradient(category);

  return (
    <div className="biz-card glass-panel animate-fade-in">
      {/* Cover / hero */}
      <div className="biz-cover" style={{ background: coverImage ? undefined : gradient }}>
        {coverImage && <img src={coverImage} alt={`${name} cover`} className="cover-img" />}
        <div className="cover-overlay" />

        {/* Badges row */}
        <div className="cover-badges">
          <span className={`status-badge ${isOpen ? 'open' : 'closed'}`}>
            <span className="status-dot" />
            {isOpen ? 'Open' : 'Closed'}
          </span>
          <span className="queue-badge">
            <Users size={11} />
            {currentQueue} in queue
          </span>
        </div>

        {/* Logo */}
        {logoImage ? (
          <img src={logoImage} alt={`${name} logo`} className="biz-logo" />
        ) : (
          <div className="biz-logo-placeholder">
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Category chip */}
        <span className="category-chip">{category}</span>
      </div>

      {/* Card body */}
      <div className="biz-body">
        <h3 className="biz-name">{name}</h3>

        <div className="biz-rating-row">
          <StarRating rating={rating} />
          <span className="review-count">({reviewCount} reviews)</span>
        </div>

        {description && (
          <p className="biz-description">{description}</p>
        )}

        <div className="biz-meta">
          {address && (
            <span className="meta-item">
              <MapPin size={13} />
              <span>{address}</span>
            </span>
          )}
          {phone && (
            <span className="meta-item">
              <Phone size={13} />
              <span>{phone}</span>
            </span>
          )}
        </div>
      </div>

      {/* CTA footer */}
      <div className="biz-footer">
        <div className="queue-info">
          <Clock size={14} />
          <span>
            {currentQueue === 0
              ? 'No wait right now'
              : `~${currentQueue * 8}–${currentQueue * 12} min wait`}
          </span>
        </div>
        <button
          className="btn-primary view-btn"
          onClick={() => onView(id)}
          aria-label={`View details for ${name}`}
        >
          <span>View Details</span>
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};

// ─── Skeleton loader card ─────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="skeleton-card glass-panel">
    <div className="skel-cover" />
    <div className="skel-body">
      <div className="skel-line wide" />
      <div className="skel-line medium" />
      <div className="skel-line narrow" />
      <div className="skel-line medium" />
    </div>
  </div>
);

// ─── Main CustomerHome ────────────────────────────────────────────────────────
const CustomerHome = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const [businesses, setBusinesses]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // ── Real-time Firestore listener ──────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);

    const q = query(collection(db, 'businesses'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBusinesses(docs);
        setLoading(false);
      },
      (err) => {
        console.error('CustomerHome: Firestore snapshot error', err);
        setError('Unable to load businesses. Please check your connection.');
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  // ── Filtering + searching ─────────────────────────────────────────────────
  const filteredBusinesses = businesses.filter((biz) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      biz.name?.toLowerCase().includes(q) ||
      biz.category?.toLowerCase().includes(q) ||
      biz.address?.toLowerCase().includes(q) ||
      biz.description?.toLowerCase().includes(q);

    const matchesCategory =
      activeCategory === 'All' || biz.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  const handleView = useCallback((id) => navigate(`/business/${id}`), [navigate]);

  const firstName = userProfile?.name?.split(' ')[0] || 'there';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="ch-wrapper">

      {/* Hero greeting */}
      <section className="ch-hero animate-fade-in">
        <div className="ch-hero-text">
          <p className="ch-greeting">Welcome back, <strong>{firstName}</strong> 👋</p>
          <h1 className="ch-title">Find a Place, Skip the Wait</h1>
          <p className="ch-subtitle">Real-time queue availability for clinics, salons, banks and more.</p>
        </div>
        <div className="live-indicator">
          <Wifi size={14} />
          <span>Live updates</span>
        </div>
      </section>

      {/* Search bar */}
      <section className="ch-search-section">
        <div className="search-wrapper">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="glass-input search-input"
            placeholder="Search by name, category, or address…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search businesses"
          />
          {searchQuery && (
            <button
              className="search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </section>

      {/* Category filter pills */}
      <section className="ch-categories">
        <div className="category-pills">
          {CATEGORIES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              className={`category-pill ${activeCategory === value ? 'active' : ''}`}
              onClick={() => setActiveCategory(value)}
              aria-pressed={activeCategory === value}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Results header */}
      <div className="results-header">
        {!loading && !error && (
          <span className="results-count">
            {filteredBusinesses.length === 0
              ? 'No results'
              : `${filteredBusinesses.length} venue${filteredBusinesses.length !== 1 ? 's' : ''} found`}
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="state-card error-state glass-panel animate-fade-in">
          <AlertTriangle size={40} className="state-icon error-icon" />
          <h3>Connection Error</h3>
          <p>{error}</p>
          <button
            className="btn-primary"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && !error && (
        <div className="biz-grid">
          {[1, 2, 3, 4, 5, 6].map(n => <SkeletonCard key={n} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredBusinesses.length === 0 && (
        <div className="state-card empty-state glass-panel animate-fade-in">
          <Store size={48} className="state-icon empty-icon" />
          <h3>
            {searchQuery || activeCategory !== 'All'
              ? 'No matches found'
              : 'No Businesses Yet'}
          </h3>
          <p>
            {searchQuery || activeCategory !== 'All'
              ? 'Try adjusting your search or clearing the category filter.'
              : 'Business owners can register via the Merchant Portal. Check back soon!'}
          </p>
          {(searchQuery || activeCategory !== 'All') && (
            <button
              className="btn-glass"
              onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Business grid */}
      {!loading && !error && filteredBusinesses.length > 0 && (
        <div className="biz-grid">
          {filteredBusinesses.map(biz => (
            <BusinessCard key={biz.id} business={biz} onView={handleView} />
          ))}
        </div>
      )}

      {/* ─── Component-scoped styles ────────────────────────────────────────── */}
      <style>{`
        /* ── Wrapper ── */
        .ch-wrapper {
          display: flex;
          flex-direction: column;
          gap: 28px;
          max-width: 1200px;
          margin: 0 auto;
          padding-bottom: 32px;
          animation: fadeIn 0.5s ease forwards;
        }

        /* ── Hero ── */
        .ch-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .ch-greeting {
          font-size: 1rem;
          color: var(--text-secondary);
          margin: 0 0 6px 0;
        }

        .ch-title {
          font-size: 2rem;
          color: var(--text-primary);
          margin: 0 0 8px 0;
        }

        .ch-subtitle {
          font-size: 0.95rem;
          color: var(--text-secondary);
          margin: 0;
          max-width: 500px;
          line-height: 1.5;
        }

        .live-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(0, 245, 212, 0.1);
          border: 1px solid rgba(0, 245, 212, 0.25);
          color: #00BFA5;
          padding: 6px 14px;
          border-radius: 50px;
          font-size: 0.78rem;
          font-weight: 600;
          white-space: nowrap;
          margin-top: 4px;
        }

        /* ── Search ── */
        .ch-search-section {
          width: 100%;
        }

        .search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          max-width: 600px;
        }

        .search-icon {
          position: absolute;
          left: 16px;
          color: var(--text-secondary);
          pointer-events: none;
          z-index: 1;
        }

        .search-input {
          padding-left: 48px !important;
          padding-right: 40px !important;
          font-size: 0.98rem;
          border-radius: 50px !important;
        }

        .search-clear {
          position: absolute;
          right: 14px;
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 0.85rem;
          cursor: pointer;
          padding: 4px;
          line-height: 1;
        }

        .search-clear:hover {
          color: var(--coral);
        }

        /* ── Category pills ── */
        .ch-categories {
          width: 100%;
        }

        .category-pills {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .category-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 16px;
          border-radius: 50px;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-secondary);
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .category-pill:hover {
          border-color: rgba(108,99,255,0.35);
          color: var(--primary);
        }

        .category-pill.active {
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-deep) 100%);
          border-color: var(--primary);
          color: #FFFFFF;
          box-shadow: 0 4px 12px rgba(108,99,255,0.3);
        }

        /* ── Results header ── */
        .results-header {
          min-height: 20px;
        }

        .results-count {
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-weight: 500;
        }

        /* ── Grid ── */
        .biz-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }

        /* ── Business Card ── */
        .biz-card {
          border-radius: var(--border-radius-lg) !important;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }

        .biz-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 16px 48px rgba(108,99,255,0.14);
        }

        /* Cover */
        .biz-cover {
          position: relative;
          height: 150px;
          overflow: hidden;
        }

        .cover-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .cover-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%);
        }

        .cover-badges {
          position: absolute;
          top: 12px;
          left: 12px;
          right: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          z-index: 2;
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 50px;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          backdrop-filter: blur(8px);
        }

        .status-badge.open {
          background: rgba(0, 200, 83, 0.88);
          color: #FFFFFF;
        }

        .status-badge.closed {
          background: rgba(30, 26, 52, 0.75);
          color: rgba(255,255,255,0.7);
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .status-badge.open .status-dot {
          background: #FFFFFF;
          box-shadow: 0 0 0 2px rgba(255,255,255,0.4);
          animation: pulseGlow 2s infinite;
        }

        .queue-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          background: rgba(108, 99, 255, 0.85);
          color: #FFFFFF;
          border-radius: 50px;
          font-size: 0.72rem;
          font-weight: 700;
          backdrop-filter: blur(8px);
        }

        /* Logo */
        .biz-logo {
          position: absolute;
          bottom: -20px;
          left: 20px;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid var(--glass-bg);
          z-index: 2;
        }

        .biz-logo-placeholder {
          position: absolute;
          bottom: -20px;
          left: 20px;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(255,255,255,0.92);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--primary);
          border: 3px solid var(--glass-bg);
          z-index: 2;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        /* Category chip */
        .category-chip {
          position: absolute;
          bottom: 12px;
          right: 14px;
          background: rgba(255,255,255,0.18);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.25);
          color: #FFFFFF;
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 2px 8px;
          border-radius: 4px;
          z-index: 2;
        }

        /* Body */
        .biz-body {
          padding: 32px 20px 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }

        .biz-name {
          font-size: 1.1rem;
          color: var(--text-primary);
          margin: 0;
          line-height: 1.3;
        }

        .biz-rating-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .stars-row {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .rating-text {
          font-size: 0.78rem;
          font-weight: 700;
          color: #FFBD59;
          margin-left: 3px;
        }

        .review-count {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .biz-description {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .biz-meta {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 4px;
        }

        .meta-item {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          font-size: 0.8rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        .meta-item svg {
          flex-shrink: 0;
          margin-top: 1px;
          color: var(--primary);
          opacity: 0.75;
        }

        /* Footer */
        .biz-footer {
          padding: 12px 20px 18px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid var(--glass-border);
          gap: 12px;
        }

        .queue-info {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          color: var(--text-secondary);
          flex: 1;
        }

        .queue-info svg {
          color: var(--teal);
          flex-shrink: 0;
        }

        .view-btn {
          padding: 8px 16px;
          font-size: 0.82rem;
          gap: 5px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* ── Skeleton ── */
        @keyframes shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position: 600px 0;  }
        }

        .skeleton-card {
          border-radius: var(--border-radius-lg) !important;
          overflow: hidden;
        }

        .skel-cover {
          height: 150px;
          background: linear-gradient(90deg,
            var(--glass-bg) 25%,
            rgba(108,99,255,0.06) 50%,
            var(--glass-bg) 75%
          );
          background-size: 600px 100%;
          animation: shimmer 1.5s infinite;
        }

        .skel-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .skel-line {
          height: 12px;
          border-radius: 6px;
          background: linear-gradient(90deg,
            var(--glass-bg) 25%,
            rgba(108,99,255,0.06) 50%,
            var(--glass-bg) 75%
          );
          background-size: 600px 100%;
          animation: shimmer 1.5s infinite;
        }

        .skel-line.wide   { width: 80%; }
        .skel-line.medium { width: 55%; }
        .skel-line.narrow { width: 35%; }

        /* ── State cards ── */
        .state-card {
          padding: 60px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 16px;
          border-radius: var(--border-radius-lg) !important;
        }

        .state-icon {
          opacity: 0.35;
        }

        .error-icon { color: var(--coral); opacity: 0.7; }
        .empty-icon { color: var(--primary); }

        .state-card h3 {
          font-size: 1.3rem;
          color: var(--text-primary);
        }

        .state-card p {
          font-size: 0.92rem;
          color: var(--text-secondary);
          line-height: 1.5;
          max-width: 420px;
        }

        .state-card .btn-primary,
        .state-card .btn-glass {
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .ch-title { font-size: 1.6rem; }
          .biz-grid { grid-template-columns: 1fr; }
          .search-wrapper { max-width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default CustomerHome;
