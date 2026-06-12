import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import useAuth from '../../hooks/useAuth';
import {
  MapPin, Phone, Star, Users, Clock, AlertTriangle,
  RefreshCw, ArrowRight, ArrowLeft, Calendar, ShieldCheck,
  MessageSquare, UserCheck, CheckCircle2, XCircle, Navigation
} from 'lucide-react';

// ─── Category Gradients Fallback ─────────────────────────────────────────────
const CATEGORY_GRADIENTS = {
  Clinic:             'linear-gradient(135deg, #FF6584 0%, #D63965 100%)',
  Salon:              'linear-gradient(135deg, #FFBD59 0%, #E6930A 100%)',
  Spa:                'linear-gradient(135deg, #00F5D4 0%, #00A896 100%)',
  Bank:               'linear-gradient(135deg, #6C63FF 0%, #4E44E7 100%)',
  'Government Office':'linear-gradient(135deg, #74B9FF 0%, #0984E3 100%)',
};

const getCategoryGradient = (cat) =>
  CATEGORY_GRADIENTS[cat] ?? 'linear-gradient(135deg, #A29BFE 0%, #6C63FF 100%)';

// ─── Star Rating Widget ───────────────────────────────────────────────────────
const StarRating = ({ rating = 0, size = 14 }) => {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.4;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="stars-row" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[...Array(full)].map((_, i) => <Star key={`f${i}`} size={size} fill="#FFBD59" stroke="none" />)}
      {half && <Star key="h" size={size} fill="#FFBD59" stroke="none" style={{ opacity: 0.5 }} />}
      {[...Array(empty)].map((_, i) => <Star key={`e${i}`} size={size} fill="none" stroke="#FFBD59" strokeWidth={1.5} />)}
      <span className="rating-text" style={{ fontSize: `${size * 0.9}px` }}>{rating.toFixed(1)}</span>
    </span>
  );
};

// ─── Business Profile Page ───────────────────────────────────────────────────
const BusinessProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [business, setBusiness] = useState(null);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [activeBooking, setActiveBooking] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [error, setError] = useState(null);

  // ── Real-Time Listeners Subscription ───────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setLoadingServices(true);
    setLoadingStaff(true);
    setLoadingReviews(true);
    setError(null);

    // 1. Business Doc Listener
    const businessRef = doc(db, 'businesses', id);
    const unsubBusiness = onSnapshot(
      businessRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setBusiness({ id: snapshot.id, ...snapshot.data() });
          setError(null);
        } else {
          setError('The requested business profile does not exist or has been removed.');
        }
        setLoading(false);
      },
      (err) => {
        console.error('BusinessProfile: Firestore business doc error', err);
        setError('Unable to load business details. Please check your connection.');
        setLoading(false);
      }
    );

    // 2. Services Subcollection Listener
    const servicesRef = collection(db, 'businesses', id, 'services');
    const unsubServices = onSnapshot(
      servicesRef,
      (snapshot) => {
        const servicesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setServices(servicesList);
        setLoadingServices(false);
      },
      (err) => {
        console.error('BusinessProfile: Firestore services subcollection error', err);
        setLoadingServices(false);
      }
    );

    // 3. Staff Subcollection Listener
    const staffRef = collection(db, 'businesses', id, 'staff');
    const unsubStaff = onSnapshot(
      staffRef,
      (snapshot) => {
        const staffList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStaff(staffList);
        setLoadingStaff(false);
      },
      (err) => {
        console.error('BusinessProfile: Firestore staff subcollection error', err);
        setLoadingStaff(false);
      }
    );

    // 4. Reviews Collection Listener (where businessId == id)
    const reviewsRef = collection(db, 'reviews');
    const reviewsQuery = query(reviewsRef, where('businessId', '==', id));
    const unsubReviews = onSnapshot(
      reviewsQuery,
      (snapshot) => {
        const reviewsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort reviews locally by createdAt desc to avoid missing index warnings
        reviewsList.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
        setReviews(reviewsList);
        setLoadingReviews(false);
      },
      (err) => {
        console.error('BusinessProfile: Firestore reviews query error', err);
        setLoadingReviews(false);
      }
    );

    // Cleanup listeners on unmount
    return () => {
      unsubBusiness();
      unsubServices();
      unsubStaff();
      unsubReviews();
    };
  }, [id]);

  // 5. Active Customer Booking Listener
  useEffect(() => {
    if (!currentUser || !id) return;

    const bookingsRef = collection(db, 'bookings');
    const q = query(
      bookingsRef,
      where('customerId', '==', currentUser.uid),
      where('businessId', '==', id),
      where('status', 'in', ['pending', 'confirmed', 'active'])
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });
        setActiveBooking(docs[0]);
      } else {
        setActiveBooking(null);
      }
    }, (err) => {
      console.error("Error listening for active bookings on BusinessProfile:", err);
    });

    return () => unsub();
  }, [currentUser, id]);

  // ── Helper Hour Formatter ──────────────────────────────────────────────────
  const renderBusinessHours = () => {
    if (!business || !business.hours) {
      return <p className="empty-text">No hours specified.</p>;
    }

    if (typeof business.hours === 'string') {
      return <p className="hours-string">{business.hours}</p>;
    }

    if (typeof business.hours === 'object' && Object.keys(business.hours).length > 0) {
      const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const sortedDays = Object.keys(business.hours).sort((a, b) => daysOrder.indexOf(a) - daysOrder.indexOf(b));

      return (
        <div className="hours-list">
          {sortedDays.map(day => (
            <div key={day} className="hours-row">
              <span className="day-name">{day}</span>
              <span className="day-time">{business.hours[day] || 'Closed'}</span>
            </div>
          ))}
        </div>
      );
    }

    return <p className="empty-text">No hours specified.</p>;
  };

  // ── Render States ──────────────────────────────────────────────────────────

  // Full-page Loader for Business Base Doc
  if (loading && !error) {
    return (
      <div className="profile-wrapper">
        <div className="skeleton-cover" />
        <div className="skeleton-header-body">
          <div className="skeleton-line title shimmer" />
          <div className="skeleton-line subtitle shimmer" />
          <div className="skeleton-line text shimmer" />
        </div>
        <div className="profile-grid">
          <div className="profile-main">
            <div className="skeleton-section shimmer" />
            <div className="skeleton-section shimmer" />
          </div>
          <div className="profile-sidebar">
            <div className="skeleton-section shimmer" />
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="state-card error-state glass-panel animate-fade-in">
        <AlertTriangle size={48} className="state-icon error-icon" />
        <h2>Profile Unavailable</h2>
        <p>{error}</p>
        <div className="error-actions">
          <button className="btn-glass" onClick={() => navigate('/home')}>
            <ArrowLeft size={16} />
            Back to Home
          </button>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const gradient = getCategoryGradient(business?.category);
  const averageRating = business?.rating ?? 0;
  const reviewCount = business?.reviewCount ?? 0;
  const currentQueue = business?.currentQueue ?? 0;
  const isOpen = business?.isOpen ?? false;

  return (
    <div className="profile-wrapper animate-fade-in">
      {/* Back button */}
      <button className="back-floating-btn" onClick={() => navigate('/home')}>
        <ArrowLeft size={16} />
        <span>Back</span>
      </button>

      {/* Hero Cover Header */}
      <section className="profile-hero">
        <div className="cover-box" style={{ background: business.coverImage ? undefined : gradient }}>
          {business.coverImage && (
            <img src={business.coverImage} alt={`${business.name} cover`} className="cover-img" />
          )}
          <div className="cover-overlay" />
        </div>

        <div className="hero-content">
          <div className="logo-badge-container">
            {/* Logo */}
            {business.logoImage ? (
              <img src={business.logoImage} alt={`${business.name} logo`} className="profile-logo" />
            ) : (
              <div className="profile-logo-placeholder">
                {business.name?.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Float badges */}
            <div className="float-badges">
              <span className={`status-badge ${isOpen ? 'open' : 'closed'}`}>
                <span className="status-dot" />
                {isOpen ? 'Open Now' : 'Closed'}
              </span>
              <span className="queue-badge">
                <Users size={12} />
                <span>{currentQueue} waiting</span>
              </span>
            </div>
          </div>

          <div className="hero-details">
            <span className="category-tag">{business.category}</span>
            <div className="title-row">
              <h1 className="business-name">{business.name}</h1>
              {business.isVerified && (
                <span className="verified-badge" title="Verified Business">
                  <ShieldCheck size={18} fill="var(--teal)" stroke="var(--main-bg)" />
                </span>
              )}
            </div>

            <div className="rating-row">
              <StarRating rating={averageRating} size={14} />
              <span className="review-count">({reviewCount} reviews)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Details Grid */}
      <div className="profile-grid">
        {/* Left Hand: Services and Staff */}
        <main className="profile-main">
          {/* Services Section */}
          <section className="profile-section glass-panel">
            <div className="section-header">
              <h2>Services Offered</h2>
              <span className="section-badge">{services.length} services</span>
            </div>

            {loadingServices ? (
              <div className="services-skeleton-grid">
                {[1, 2].map(n => (
                  <div key={n} className="skel-service shimmer" />
                ))}
              </div>
            ) : services.length === 0 ? (
              <div className="section-empty-state">
                <p>No services registered for this business.</p>
              </div>
            ) : (
              <div className="services-grid">
                {services.map((service) => {
                  const available = service.isAvailable !== false && service.isActive !== false;
                  return (
                    <div key={service.id} className={`service-item-card ${!available ? 'unavailable' : ''}`}>
                      <div className="service-info-col">
                        <div className="service-name-row">
                          <h3>{service.name}</h3>
                          {!available && <span className="item-status-badge closed">Unavailable</span>}
                        </div>
                        {service.description && <p className="service-desc">{service.description}</p>}
                        <div className="service-meta-row">
                          <span className="service-meta-chip">
                            <Clock size={12} />
                            {service.durationMinutes || service.duration || 0} mins
                          </span>
                        </div>
                      </div>
                      <div className="service-price-col">
                        <span className="price-tag">₹{service.price}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Staff Section */}
          <section className="profile-section glass-panel">
            <div className="section-header">
              <h2>Staff Members</h2>
              <span className="section-badge">{staff.length} staff</span>
            </div>

            {loadingStaff ? (
              <div className="staff-skeleton-grid">
                {[1, 2, 3].map(n => (
                  <div key={n} className="skel-staff shimmer" />
                ))}
              </div>
            ) : staff.length === 0 ? (
              <div className="section-empty-state">
                <p>No staff members assigned to this venue.</p>
              </div>
            ) : (
              <div className="staff-grid">
                {staff.map((member) => {
                  const active = member.isActive !== false && member.isAvailable !== false;
                  const specialization = member.role || member.specialization || 'Team Member';
                  return (
                    <div key={member.id} className={`staff-card ${!active ? 'inactive' : ''}`}>
                      {member.avatar || member.profileImage ? (
                        <img src={member.avatar || member.profileImage} alt={member.name} className="staff-avatar" />
                      ) : (
                        <div className="staff-avatar-placeholder">
                          {member.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="staff-info">
                        <h3>{member.name}</h3>
                        <p className="staff-specialty">{specialization}</p>
                        <span className={`staff-status ${active ? 'active' : 'inactive'}`}>
                          {active ? 'Available' : 'Away'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        {/* Right Hand: Location, Phone, Hours, Reviews */}
        <aside className="profile-sidebar">
          {/* Active Booking Navigation Card */}
          {activeBooking && (
            <section className="profile-section glass-panel" style={{ border: '1px solid rgba(0, 230, 180, 0.35)', background: 'rgba(0, 230, 180, 0.02)' }}>
              <div className="section-header" style={{ borderBottom: '1px solid rgba(0, 230, 180, 0.15)' }}>
                <h2 style={{ color: 'var(--teal)' }}>Active Booking</h2>
              </div>
              <p className="about-description" style={{ fontSize: '0.85rem' }}>
                You have a live booking (Token: <strong>{activeBooking.tokenNumber || '—'}</strong>) at this venue. Use Smart Travel to track live arrival time.
              </p>
              <button
                className="btn-primary"
                onClick={() => navigate(`/smart-route/${activeBooking.id}`)}
                style={{ background: 'var(--teal)', borderColor: 'var(--teal)', color: '#000', width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Navigation size={14} />
                <span>Navigate Smartly</span>
              </button>
            </section>
          )}

          {/* Info Card */}
          <section className="profile-section glass-panel">
            <h2>About & Hours</h2>
            {business.description && <p className="about-description">{business.description}</p>}

            <div className="contact-details">
              {business.address && (
                <div className="contact-item">
                  <MapPin size={16} />
                  <span>{business.address}</span>
                </div>
              )}
              {business.phone && (
                <div className="contact-item">
                  <Phone size={16} />
                  <a href={`tel:${business.phone}`} className="phone-link">{business.phone}</a>
                </div>
              )}
            </div>

            <hr className="divider" />

            <div className="hours-section">
              <h3>Operating Hours</h3>
              {renderBusinessHours()}
            </div>

            <hr className="divider" />

            <div className="estimated-wait-card">
              <div className="wait-icon">
                <Clock size={20} />
              </div>
              <div className="wait-text">
                <p className="wait-title">Estimated Wait Time</p>
                <p className="wait-duration">
                  {currentQueue === 0
                    ? 'No delay'
                    : `~${currentQueue * 8}–${currentQueue * 12} mins`}
                </p>
              </div>
            </div>
          </section>

          {/* Customer Reviews Section */}
          <section className="profile-section glass-panel">
            <div className="section-header">
              <h2>Customer Reviews</h2>
              <span className="section-badge">{reviews.length} total</span>
            </div>

            {loadingReviews ? (
              <div className="reviews-skeleton">
                <div className="skel-review shimmer" />
                <div className="skel-review shimmer" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="section-empty-state">
                <p>No reviews posted yet. Be the first to share your experience!</p>
              </div>
            ) : (
              <div className="reviews-list">
                {reviews.map((rev) => (
                  <div key={rev.id} className="review-card">
                    <div className="review-header">
                      <div className="review-author">
                        <h4>{rev.customerName || 'Anonymous'}</h4>
                        <span className="review-date">
                          {rev.createdAt?.seconds
                            ? new Date(rev.createdAt.seconds * 1000).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })
                            : 'Just now'}
                        </span>
                      </div>
                      <StarRating rating={rev.rating || 0} size={10} />
                    </div>
                    <p className="review-text">{rev.text || rev.comment || 'No review details shared.'}</p>

                    {rev.reply && (
                      <div className="owner-reply-box">
                        <div className="reply-header">
                          <MessageSquare size={10} />
                          <span>Owner's Response</span>
                          {rev.repliedAt?.seconds && (
                            <span className="reply-date">
                              {new Date(rev.repliedAt.seconds * 1000).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="reply-text">{rev.reply}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* Sticky Bottom Booking Bar */}
      <div className="sticky-booking-bar glass-panel">
        <div className="booking-bar-content">
          <div className="bar-info">
            <h4>Ready to visit?</h4>
            <p>Select services, assign staff, and reserve your slot.</p>
          </div>
          <div className="booking-bar-actions" style={{ display: 'flex', gap: '12px' }}>
            {activeBooking && (
              <button
                className="btn-primary booking-cta-btn"
                onClick={() => navigate(`/smart-route/${activeBooking.id}`)}
                style={{ background: 'var(--teal)', borderColor: 'var(--teal)', color: '#000', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Navigation size={16} />
                <span>Navigate Smartly</span>
              </button>
            )}
            <button
              className="btn-primary booking-cta-btn"
              onClick={() => navigate(`/business/${id}/services`)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span>Book Appointment</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Scoped CSS Styles */}
      <style>{`
        .profile-wrapper {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto;
          padding-bottom: 120px;
          position: relative;
        }

        /* Back Button */
        .back-floating-btn {
          position: absolute;
          top: 16px;
          left: 16px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(15, 12, 30, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #FFFFFF;
          padding: 8px 16px;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          backdrop-filter: blur(8px);
          transition: all 0.2s ease;
        }

        .back-floating-btn:hover {
          background: rgba(15, 12, 30, 0.8);
          border-color: var(--primary);
          transform: translateX(-2px);
        }

        /* Hero Panel */
        .profile-hero {
          position: relative;
          border-radius: var(--border-radius-lg);
          overflow: hidden;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
        }

        .cover-box {
          height: 240px;
          position: relative;
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
          background: linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.65) 100%);
        }

        .hero-content {
          position: relative;
          padding: 0 24px 24px 24px;
          margin-top: -50px;
          display: flex;
          align-items: flex-end;
          gap: 24px;
          flex-wrap: wrap;
          z-index: 2;
        }

        .logo-badge-container {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .profile-logo {
          width: 110px;
          height: 110px;
          border-radius: 50%;
          object-fit: cover;
          border: 4px solid var(--main-bg);
          background: var(--main-bg);
          box-shadow: 0 8px 24px rgba(0,0,0,0.25);
        }

        .profile-logo-placeholder {
          width: 110px;
          height: 110px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.8rem;
          font-weight: 700;
          color: var(--primary);
          border: 4px solid var(--main-bg);
          box-shadow: 0 8px 24px rgba(0,0,0,0.25);
        }

        .float-badges {
          display: flex;
          gap: 8px;
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 50px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          backdrop-filter: blur(8px);
        }

        .status-badge.open {
          background: rgba(0, 200, 83, 0.85);
          color: #FFFFFF;
        }

        .status-badge.closed {
          background: rgba(30, 26, 52, 0.8);
          color: rgba(255,255,255,0.7);
          border: 1px solid rgba(255,255,255,0.1);
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
          padding: 4px 10px;
          background: rgba(108, 99, 255, 0.85);
          color: #FFFFFF;
          border-radius: 50px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .hero-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 250px;
          padding-bottom: 8px;
        }

        .category-tag {
          align-self: flex-start;
          background: rgba(108, 99, 255, 0.15);
          border: 1px solid rgba(108, 99, 255, 0.3);
          color: var(--primary);
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 3px 10px;
          border-radius: 4px;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .business-name {
          font-size: 2rem;
          color: var(--text-primary);
          margin: 0;
          font-weight: 700;
          line-height: 1.2;
        }

        .verified-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
        }

        .rating-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .stars-row {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .rating-text {
          font-weight: 700;
          color: #FFBD59;
          margin-left: 3px;
        }

        .review-count {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        /* Grid Layout */
        .profile-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 900px) {
          .profile-grid {
            grid-template-columns: 1fr;
          }
          .hero-content {
            margin-top: -40px;
            justify-content: center;
            text-align: center;
          }
          .category-tag {
            align-self: center;
          }
          .title-row {
            justify-content: center;
          }
          .rating-row {
            justify-content: center;
          }
        }

        /* Sections */
        .profile-main, .profile-sidebar {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .profile-section {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .profile-section h2 {
          font-size: 1.25rem;
          color: var(--text-primary);
          margin: 0;
          font-weight: 600;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 12px;
        }

        .section-badge {
          font-size: 0.78rem;
          background: rgba(255,255,255,0.06);
          padding: 4px 10px;
          border-radius: 20px;
          color: var(--text-secondary);
          border: 1px solid var(--glass-border);
        }

        /* Services section */
        .services-grid {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .service-item-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }

        .service-item-card:hover {
          transform: translateX(4px);
          border-color: rgba(108,99,255,0.3);
          background: rgba(255,255,255,0.04);
        }

        .service-item-card.unavailable {
          opacity: 0.6;
        }

        .service-info-col {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }

        .service-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .service-name-row h3 {
          font-size: 1rem;
          color: var(--text-primary);
          margin: 0;
          font-weight: 600;
        }

        .item-status-badge {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .item-status-badge.closed {
          background: rgba(239, 83, 80, 0.15);
          color: #EF5350;
          border: 1px solid rgba(239, 83, 80, 0.25);
        }

        .service-desc {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.4;
        }

        .service-meta-row {
          display: flex;
          gap: 8px;
        }

        .service-meta-chip {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .service-price-col {
          text-align: right;
          flex-shrink: 0;
        }

        .price-tag {
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--teal);
        }

        /* Staff section */
        .staff-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }

        .staff-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
        }

        .staff-card.inactive {
          opacity: 0.55;
        }

        .staff-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--glass-border);
        }

        .staff-avatar-placeholder {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(108, 99, 255, 0.15);
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          font-weight: 700;
          border: 2px solid var(--glass-border);
        }

        .staff-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .staff-info h3 {
          font-size: 0.88rem;
          color: var(--text-primary);
          margin: 0;
          font-weight: 600;
        }

        .staff-specialty {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin: 0;
        }

        .staff-status {
          font-size: 0.68rem;
          font-weight: 600;
        }

        .staff-status.active {
          color: var(--teal);
        }

        .staff-status.inactive {
          color: var(--text-secondary);
        }

        /* About & Hours Sidebar Card */
        .about-description {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0;
        }

        .contact-details {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 4px;
        }

        .contact-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        .contact-item svg {
          margin-top: 2px;
          color: var(--primary);
          flex-shrink: 0;
        }

        .phone-link {
          color: var(--text-secondary);
          text-decoration: none;
          transition: color 0.2s;
        }

        .phone-link:hover {
          color: var(--primary);
        }

        .divider {
          border: none;
          height: 1px;
          background: var(--glass-border);
          margin: 8px 0;
        }

        .hours-section h3 {
          font-size: 0.95rem;
          color: var(--text-primary);
          margin: 0 0 10px 0;
          font-weight: 600;
        }

        .hours-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .hours-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.82rem;
        }

        .day-name {
          color: var(--text-secondary);
          font-weight: 500;
        }

        .day-time {
          color: var(--text-primary);
          font-weight: 600;
        }

        .hours-string {
          font-size: 0.85rem;
          color: var(--text-primary);
          margin: 0;
          line-height: 1.4;
        }

        .estimated-wait-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(0, 245, 212, 0.04);
          border: 1px solid rgba(0, 245, 212, 0.15);
          border-radius: var(--border-radius-md);
        }

        .wait-icon {
          color: var(--teal);
          display: flex;
          align-items: center;
        }

        .wait-text {
          display: flex;
          flex-direction: column;
        }

        .wait-title {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin: 0;
        }

        .wait-duration {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        /* Reviews section */
        .reviews-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .review-card {
          background: rgba(255,255,255,0.01);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .review-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .review-author h4 {
          font-size: 0.88rem;
          color: var(--text-primary);
          margin: 0 0 2px 0;
          font-weight: 600;
        }

        .review-date {
          font-size: 0.72rem;
          color: var(--text-secondary);
        }

        .review-text {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.45;
          margin: 0;
        }

        .owner-reply-box {
          margin-top: 6px;
          padding: 10px 12px;
          background: rgba(108, 99, 255, 0.03);
          border-left: 3px solid var(--primary);
          border-radius: 0 6px 6px 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .reply-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--primary);
        }

        .reply-header svg {
          color: var(--primary);
        }

        /* Sticky Booking Bar */
        .sticky-booking-bar {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 48px);
          max-width: 800px;
          padding: 16px 24px;
          border-radius: 50px !important;
          z-index: 100;
          box-shadow: 0 16px 40px rgba(0,0,0,0.35);
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          backdrop-filter: blur(16px);
        }

        .booking-bar-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }

        .bar-info h4 {
          font-size: 0.95rem;
          color: var(--text-primary);
          margin: 0 0 2px 0;
          font-weight: 600;
        }

        .bar-info p {
          font-size: 0.78rem;
          color: var(--text-secondary);
          margin: 0;
        }

        .booking-cta-btn {
          padding: 10px 24px;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 600;
          gap: 8px;
          white-space: nowrap;
        }

        @media (max-width: 600px) {
          .booking-bar-content {
            flex-direction: column;
            text-align: center;
            gap: 12px;
          }
          .sticky-booking-bar {
            border-radius: var(--border-radius-lg) !important;
            bottom: 16px;
          }
          .booking-cta-btn {
            width: 100%;
          }
        }

        /* Skeletons & Shimmer */
        .skeleton-cover {
          height: 240px;
          background: var(--glass-bg);
          border-radius: var(--border-radius-lg);
        }

        .skeleton-header-body {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 16px;
        }

        .skeleton-line {
          height: 14px;
          border-radius: 4px;
          background: var(--glass-bg);
        }

        .skeleton-line.title {
          height: 28px;
          width: 40%;
        }

        .skeleton-line.subtitle {
          width: 20%;
        }

        .skeleton-line.text {
          width: 70%;
        }

        .skeleton-section {
          height: 180px;
          background: var(--glass-bg);
          border-radius: var(--border-radius-lg);
        }

        .services-skeleton-grid, .staff-skeleton-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .skel-service {
          height: 70px;
          background: rgba(255,255,255,0.02);
          border-radius: var(--border-radius-md);
        }

        .skel-staff {
          height: 50px;
          background: rgba(255,255,255,0.02);
          border-radius: var(--border-radius-md);
        }

        .skel-review {
          height: 90px;
          background: rgba(255,255,255,0.02);
          border-radius: var(--border-radius-md);
          margin-bottom: 12px;
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .shimmer {
          background: linear-gradient(90deg, 
            rgba(255,255,255,0.02) 25%, 
            rgba(255,255,255,0.06) 50%, 
            rgba(255,255,255,0.02) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        .section-empty-state {
          padding: 24px;
          text-align: center;
          background: rgba(255,255,255,0.01);
          border: 1px dashed var(--glass-border);
          border-radius: var(--border-radius-md);
        }

        .section-empty-state p {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0;
        }

        /* Error state styling extension */
        .error-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .error-actions button {
          display: flex;
          align-items: center;
          gap: 6px;
        }
      `}</style>
    </div>
  );
};

export default BusinessProfile;
