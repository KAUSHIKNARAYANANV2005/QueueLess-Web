import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import useAuth from '../../hooks/useAuth';
import {
  Users,
  Star,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarDays,
  LayoutDashboard,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Scissors,
  UserCog,
  Settings,
  ListOrdered,
  TrendingUp,
  Loader2,
  Hash,
  Wifi,
  Building2,
  Activity,
  MessageSquare,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isToday = (ts) => {
  if (!ts) return false;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
};

const formatTime = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const STATUS_STYLES = {
  pending:   { bg: 'rgba(255,193,7,0.12)',  border: 'rgba(255,193,7,0.35)',  text: '#FFC107' },
  confirmed: { bg: 'rgba(108,99,255,0.12)', border: 'rgba(108,99,255,0.35)', text: 'var(--primary)' },
  active:    { bg: 'rgba(0,230,180,0.12)',  border: 'rgba(0,230,180,0.35)',  text: 'var(--teal)' },
  cancelled: { bg: 'rgba(239,83,80,0.12)',  border: 'rgba(239,83,80,0.35)',  text: '#EF5350' },
  served:    { bg: 'rgba(76,175,80,0.12)',  border: 'rgba(76,175,80,0.35)',  text: '#4CAF50' },
};
const STATUS_LABELS = {
  pending: 'Pending', confirmed: 'Confirmed',
  active: 'Active', cancelled: 'Cancelled', served: 'Served',
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const Skeleton = ({ style = {} }) => (
  <div className="db-skeleton" style={style} />
);

const StatCard = ({ icon: Icon, label, value, sub, accent, gradient }) => (
  <div className="db-stat-card glass-panel" style={gradient ? { borderColor: 'transparent', background: gradient } : {}}>
    <div className="db-stat-icon-wrap" style={{ background: accent ? `${accent}22` : undefined }}>
      <Icon size={18} style={{ color: accent || 'var(--primary)' }} />
    </div>
    <div className="db-stat-body">
      <span className="db-stat-value" style={{ color: accent || 'var(--text-primary)' }}>
        {value ?? '—'}
      </span>
      <span className="db-stat-label">{label}</span>
      {sub && <span className="db-stat-sub">{sub}</span>}
    </div>
  </div>
);

const QuickActionBtn = ({ icon: Icon, label, to, navigate, accent }) => (
  <button
    className="db-quick-action glass-panel"
    onClick={() => navigate(to)}
    style={{ '--qa-accent': accent || 'var(--primary)' }}
  >
    <div className="db-qa-icon" style={{ background: accent ? `${accent}22` : 'rgba(108,99,255,0.12)' }}>
      <Icon size={20} style={{ color: accent || 'var(--primary)' }} />
    </div>
    <span>{label}</span>
    <ArrowRight size={14} className="db-qa-arrow" />
  </button>
);

// ─── BusinessDashboard ────────────────────────────────────────────────────────
const BusinessDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // State
  const [business, setBusiness]   = useState(null);
  const [queueDoc, setQueueDoc]   = useState(null);
  const [bookings, setBookings]   = useState([]);
  const [reviews, setReviews]     = useState([]);

  const [resolvingBiz, setResolvingBiz] = useState(true);
  const [loadingData, setLoadingData]   = useState(true);
  const [error, setError]               = useState(null);

  // ── Step 1: Resolve businessId from ownerId ─────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.uid && currentUser.uid.startsWith('mock-')) {
      setBusiness({
        id: 'mock-business-id',
        name: 'Mock Merchant Salon',
        category: 'Salon',
        description: 'A premium salon experience for testing.',
        address: '123 Test Street, Developer City',
        lat: 12.971598,
        lng: 77.594562,
        phone: '1234567890',
        rating: 4.8,
        reviewCount: 1,
        isVerified: true,
        plan: 'premium',
        coverImage: null,
        logoImage: null,
        hours: null,
        ownerId: currentUser.uid,
        currentQueue: 0,
        isOpen: true,
        createdAt: new Date(),
      });
      setQueueDoc({
        id: 'mock-business-id',
        totalWaiting: 2,
        currentServingToken: 'T-01',
        currentServingName: 'John Doe',
        currentServingService: 'Haircut',
        items: [
          { bookingId: 'mock-b1', position: 1, customerName: 'Alice Smith', serviceName: 'Shaving', waitMinutes: 10 },
          { bookingId: 'mock-b2', position: 2, customerName: 'Bob Jones', serviceName: 'Facial', waitMinutes: 20 },
        ],
      });
      setBookings([
        { id: 'mock-bk1', customerName: 'John Doe', serviceName: 'Haircut', status: 'served', price: 500, createdAt: new Date() },
        { id: 'mock-bk2', customerName: 'Alice Smith', serviceName: 'Shaving', status: 'active', price: 300, createdAt: new Date() },
        { id: 'mock-bk3', customerName: 'Bob Jones', serviceName: 'Facial', status: 'active', price: 800, createdAt: new Date() },
      ]);
      setReviews([
        { id: 'mock-rv1', customerName: 'Charlie Brown', rating: 5, comment: 'Excellent mock service!' },
      ]);
      setResolvingBiz(false);
      setLoadingData(false);
      return;
    }

    const q = query(
      collection(db, 'businesses'),
      where('ownerId', '==', currentUser.uid),
      limit(1)
    );

    getDocs(q)
      .then((snap) => {
        if (snap.empty) {
          setError('No business profile found for your account.');
          setResolvingBiz(false);
          setLoadingData(false);
          return;
        }
        const docSnap = snap.docs[0];
        setBusiness({ id: docSnap.id, ...docSnap.data() });
        setResolvingBiz(false);
      })
      .catch((err) => {
        console.error('Dashboard: resolve business failed', err);
        setError('Failed to load your business profile.');
        setResolvingBiz(false);
        setLoadingData(false);
      });
  }, [currentUser]);

  // ── Step 1, 2, 3, 4, 5: Listeners ──────────────────────────────────────────
  useEffect(() => {
    const isMock = currentUser?.uid?.startsWith('mock-') || localStorage.getItem('mockUser');
    if (isMock) {
      setBusiness({
        id: 'mock-biz-1',
        name: 'Supreme Salon & Spa',
        category: 'Salon',
        description: 'Premium haircare, styling, and wellness treatments.',
        address: '123 Style Boulevard, Glamour City',
        phone: '1234567890',
        rating: 4.8,
        reviewCount: 24,
        currentQueue: 3,
        isOpen: true,
        hours: {
          Monday: '09:00 AM - 09:00 PM',
          Tuesday: '09:00 AM - 09:00 PM',
          Wednesday: '09:00 AM - 09:00 PM',
          Thursday: '09:00 AM - 09:00 PM',
          Friday: '09:00 AM - 09:00 PM',
          Saturday: '09:00 AM - 09:00 PM',
          Sunday: '09:00 AM - 09:00 PM'
        }
      });
      setQueueDoc({
        businessId: 'mock-biz-1',
        totalWaiting: 3,
        currentServingToken: 'AG-A1',
        currentServingName: 'John',
        currentServingService: 'Premium Haircut',
        avgWaitMinutes: 10,
        items: [
          { bookingId: 'mock-booking-2', customerName: 'David', serviceName: 'Manicure', position: 1, status: 'waiting', waitMinutes: 10 },
          { bookingId: 'mock-booking-3', customerName: 'Sophia', serviceName: 'Facial', position: 2, status: 'waiting', waitMinutes: 20 }
        ]
      });
      setBookings([
        { id: 'mock-booking-1', customerName: 'John', serviceName: 'Premium Haircut', status: 'served', dateTime: new Date(), price: 350, paymentStatus: 'paid', tokenNumber: 'AG-A1' },
        { id: 'mock-booking-2', customerName: 'David', serviceName: 'Manicure', status: 'waiting', dateTime: new Date(), price: 200, paymentStatus: 'pending', tokenNumber: 'AG-A2' },
        { id: 'mock-booking-3', customerName: 'Sophia', serviceName: 'Facial', status: 'waiting', dateTime: new Date(), price: 800, paymentStatus: 'pending', tokenNumber: 'AG-A3' }
      ]);
      setReviews([
        { id: 'mock-review-1', customerName: 'John Doe', rating: 5, text: 'Great haircut experience!' },
        { id: 'mock-review-2', customerName: 'Mary Jane', rating: 4, text: 'Polite staff and fast service.' }
      ]);
      setResolvingBiz(false);
      setLoadingData(false);
      return;
    }

    if (!currentUser) return;

    // Real-time listener for standard user logins
    let unsubBiz = null;
    let unsubQueue = null;
    let unsubBookings = null;
    let unsubReviews = null;

    const qBiz = query(
      collection(db, 'businesses'),
      where('ownerId', '==', currentUser.uid),
      limit(1)
    );

    getDocs(qBiz)
      .then((snap) => {
        if (snap.empty) {
          setError('No business registered under this account.');
          setResolvingBiz(false);
          return;
        }

        const bId = snap.docs[0].id;
        setBusiness({ id: bId, ...snap.docs[0].data() });
        setResolvingBiz(false);

        // Subscribes
        unsubBiz = onSnapshot(doc(db, 'businesses', bId), (s) => {
          if (s.exists()) setBusiness({ id: s.id, ...s.data() });
        });

        unsubQueue = onSnapshot(doc(db, 'queues', bId), (s) => {
          setQueueDoc(s.exists() ? { id: s.id, ...s.data() } : null);
        });

        unsubBookings = onSnapshot(
          query(collection(db, 'bookings'), where('businessId', '==', bId)),
          (s) => {
            setBookings(s.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoadingData(false);
          }
        );

        unsubReviews = onSnapshot(
          query(collection(db, 'reviews'), where('businessId', '==', bId)),
          (s) => setReviews(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );
      })
      .catch((err) => {
        console.error('Dashboard error:', err);
        setError('Failed to load business profile.');
        setResolvingBiz(false);
      });

    return () => {
      if (unsubBiz) unsubBiz();
      if (unsubQueue) unsubQueue();
      if (unsubBookings) unsubBookings();
      if (unsubReviews) unsubReviews();
    };
  }, [currentUser]);

  // ── Derived metrics ─────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const todayBookings   = bookings.filter((b) => isToday(b.dateTime || b.createdAt));
    const activeBookings  = bookings.filter((b) => ['pending', 'confirmed', 'active'].includes(b.status));
    const servedCount     = bookings.filter((b) => b.status === 'served').length;
    const cancelledCount  = bookings.filter((b) => b.status === 'cancelled').length;

    const avgRating = reviews.length
      ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length).toFixed(1)
      : '—';

    const totalWaiting    = queueDoc?.totalWaiting ?? 0;
    const currentQueue    = business?.currentQueue ?? totalWaiting;
    const currentServing  = queueDoc?.currentServingToken || null;
    const currentName     = queueDoc?.currentServingName || '';
    const currentService  = queueDoc?.currentServingService || '';

    // Next 5 items in queue (excluding currently serving)
    const waitingItems = (queueDoc?.items || [])
      .filter((it) => it.status !== 'served')
      .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
      .slice(0, 5);

    // Recent bookings sorted by dateTime/createdAt desc
    const recentBookings = [...bookings]
      .sort((a, b) => {
        const ta = (a.createdAt?.toDate?.() || new Date(0)).getTime();
        const tb = (b.createdAt?.toDate?.() || new Date(0)).getTime();
        return tb - ta;
      })
      .slice(0, 8);

    return {
      todayCount: todayBookings.length,
      activeCount: activeBookings.length,
      servedCount,
      cancelledCount,
      avgRating,
      reviewCount: reviews.length,
      totalWaiting,
      currentQueue,
      currentServing,
      currentName,
      currentService,
      waitingItems,
      recentBookings,
    };
  }, [bookings, reviews, queueDoc, business]);

  // ── Loading / Error / Empty states ──────────────────────────────────────
  if (resolvingBiz || (loadingData && !error)) {
    return (
      <div className="db-wrapper animate-fade-in">
        <div className="db-skel-header">
          <Skeleton style={{ width: 180, height: 14, borderRadius: 6 }} />
          <Skeleton style={{ width: 300, height: 32, borderRadius: 8, marginTop: 10 }} />
          <Skeleton style={{ width: 220, height: 14, borderRadius: 6, marginTop: 8 }} />
        </div>
        <div className="db-stat-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-panel db-stat-card">
              <Skeleton style={{ width: 36, height: 36, borderRadius: 8 }} />
              <div className="db-stat-body">
                <Skeleton style={{ width: 60, height: 22, borderRadius: 6 }} />
                <Skeleton style={{ width: 80, height: 12, borderRadius: 4, marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
        <div className="db-lower-grid">
          <div className="glass-panel db-section-card">
            <Skeleton style={{ height: 16, width: '40%', marginBottom: 18 }} />
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} style={{ height: 52, borderRadius: 8, marginBottom: 10 }} />
            ))}
          </div>
          <div className="glass-panel db-section-card">
            <Skeleton style={{ height: 16, width: '50%', marginBottom: 18 }} />
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} style={{ height: 40, borderRadius: 8, marginBottom: 10 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="db-state-center glass-panel animate-fade-in">
        <AlertTriangle size={44} className="db-state-icon-warn" />
        <h2>Could not load dashboard</h2>
        <p>{error}</p>
        <button className="btn-primary db-state-btn" onClick={() => window.location.reload()}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="db-state-center glass-panel animate-fade-in">
        <Building2 size={44} className="db-state-icon-primary" />
        <h2>No Business Found</h2>
        <p>Your account has no associated business profile. Please contact support.</p>
      </div>
    );
  }

  const { isOpen = false, name: bizName = 'Your Business', category = '' } = business;

  return (
    <div className="db-wrapper animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="db-header">
        <div className="db-header-left">
          <span className="db-eyebrow">
            <LayoutDashboard size={13} />
            Business Dashboard
          </span>
          <h1 className="db-title">{bizName}</h1>
          <div className="db-header-meta">
            <span className="db-category-pill">{category}</span>
            <span className={`db-status-pill ${isOpen ? 'open' : 'closed'}`}>
              <span className="db-status-dot" />
              {isOpen ? 'Open Now' : 'Closed'}
            </span>
          </div>
        </div>

        {/* Live badge */}
        <div className="db-live-badge">
          <Wifi size={12} />
          <span>LIVE</span>
        </div>
      </header>

      {/* ── Stat Cards ──────────────────────────────────────────────────── */}
      <section className="db-stat-grid" aria-label="Key metrics">
        <StatCard
          icon={Users}
          label="Current Queue"
          value={metrics.currentQueue}
          sub="people waiting"
          accent="var(--primary)"
        />
        <StatCard
          icon={ListOrdered}
          label="Total Waiting"
          value={metrics.totalWaiting}
          sub="in live queue"
          accent="#6C63FF"
        />
        <StatCard
          icon={CalendarDays}
          label="Today's Bookings"
          value={metrics.todayCount}
          sub="scheduled today"
          accent="#00E6B4"
        />
        <StatCard
          icon={Activity}
          label="Active Bookings"
          value={metrics.activeCount}
          sub="pending + confirmed"
          accent="#FFBD59"
        />
        <StatCard
          icon={CheckCircle2}
          label="Served Today"
          value={metrics.servedCount}
          sub={`${metrics.cancelledCount} cancelled`}
          accent="#4CAF50"
        />
        <StatCard
          icon={Star}
          label="Avg. Rating"
          value={metrics.avgRating}
          sub={`${metrics.reviewCount} reviews`}
          accent="#FFC107"
        />
      </section>

      {/* ── Lower Grid ──────────────────────────────────────────────────── */}
      <div className="db-lower-grid">

        {/* Left col: Queue Preview + Recent Bookings */}
        <div className="db-main-col">

          {/* Live Queue Preview */}
          <section className="glass-panel db-section-card" id="db-queue-preview">
            <div className="db-section-header">
              <div className="db-sh-left">
                <Hash size={16} className="db-sh-icon" />
                <h2>Live Queue Preview</h2>
              </div>
              <span className="db-queue-total-badge">
                {metrics.totalWaiting} waiting
              </span>
            </div>

            {/* Currently Serving */}
            <div className="db-now-serving-row">
              <div className="db-ns-label">
                <span className="db-ns-dot" />
                Now Serving
              </div>
              {metrics.currentServing ? (
                <div className="db-ns-info">
                  <span className="db-ns-token">{metrics.currentServing}</span>
                  <div className="db-ns-details">
                    <span className="db-ns-name">{metrics.currentName}</span>
                    <span className="db-ns-service">{metrics.currentService}</span>
                  </div>
                </div>
              ) : (
                <span className="db-ns-empty">No one currently being served</span>
              )}
            </div>

            {/* Waiting list */}
            {metrics.waitingItems.length > 0 ? (
              <div className="db-queue-list">
                {metrics.waitingItems.map((item, idx) => (
                  <div key={item.bookingId || idx} className="db-queue-item">
                    <span className="db-qi-pos">#{item.position}</span>
                    <div className="db-qi-info">
                      <span className="db-qi-name">{item.customerName || '—'}</span>
                      <span className="db-qi-service">{item.serviceName || '—'}</span>
                    </div>
                    <div className="db-qi-right">
                      <Clock size={12} />
                      <span>~{item.waitMinutes ?? '?'} min</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="db-queue-empty">
                <Users size={28} className="db-queue-empty-icon" />
                <p>No customers currently in queue</p>
              </div>
            )}
          </section>

          {/* Recent Bookings */}
          <section className="glass-panel db-section-card" id="db-recent-bookings">
            <div className="db-section-header">
              <div className="db-sh-left">
                <TrendingUp size={16} className="db-sh-icon" />
                <h2>Recent Bookings</h2>
              </div>
              <span className="db-sh-count">{bookings.length} total</span>
            </div>

            {metrics.recentBookings.length > 0 ? (
              <div className="db-booking-list">
                {/* Header row */}
                <div className="db-bl-header">
                  <span>Customer</span>
                  <span>Service</span>
                  <span>Date</span>
                  <span>Status</span>
                  <span>Price</span>
                </div>

                {metrics.recentBookings.map((bk) => {
                  const st = STATUS_STYLES[bk.status] || STATUS_STYLES.pending;
                  return (
                    <div key={bk.id} className="db-bl-row">
                      <div className="db-bl-customer">
                        <span className="db-bl-avatar">
                          {(bk.customerName || '?')[0].toUpperCase()}
                        </span>
                        <div>
                          <span className="db-bl-name">{bk.customerName || '—'}</span>
                          <span className="db-bl-token">{bk.tokenNumber || ''}</span>
                        </div>
                      </div>
                      <span className="db-bl-service">{bk.serviceName || '—'}</span>
                      <div className="db-bl-date">
                        <span>{formatDate(bk.dateTime || bk.createdAt)}</span>
                        <span className="db-bl-time">{formatTime(bk.dateTime || bk.createdAt)}</span>
                      </div>
                      <span
                        className="db-bl-status"
                        style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.text }}
                      >
                        {STATUS_LABELS[bk.status] || bk.status}
                      </span>
                      <span className="db-bl-price">₹{bk.price ?? '—'}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="db-queue-empty">
                <CalendarDays size={28} className="db-queue-empty-icon" />
                <p>No bookings yet for your business</p>
              </div>
            )}
          </section>
        </div>

        {/* Right col: Quick Actions */}
        <aside className="db-sidebar-col">
          <section className="glass-panel db-section-card db-qa-section" id="db-quick-actions">
            <div className="db-section-header">
              <div className="db-sh-left">
                <Activity size={16} className="db-sh-icon" />
                <h2>Quick Actions</h2>
              </div>
            </div>

            <div className="db-qa-grid">
              <QuickActionBtn
                icon={ListOrdered}
                label="Manage Queue"
                to="/queue-manager"
                navigate={navigate}
                accent="#6C63FF"
              />
              <QuickActionBtn
                icon={Scissors}
                label="Manage Services"
                to="/services"
                navigate={navigate}
                accent="#00E6B4"
              />
              <QuickActionBtn
                icon={UserCog}
                label="Manage Staff"
                to="/staff"
                navigate={navigate}
                accent="#FFBD59"
              />
              <QuickActionBtn
                icon={Settings}
                label="Business Settings"
                to="/settings"
                navigate={navigate}
                accent="#74B9FF"
              />
            </div>
          </section>

          {/* Rating summary */}
          <section className="glass-panel db-section-card" id="db-ratings">
            <div className="db-section-header">
              <div className="db-sh-left">
                <Star size={16} className="db-sh-icon" style={{ color: '#FFC107' }} />
                <h2>Ratings & Reviews</h2>
              </div>
            </div>

            <div className="db-rating-hero">
              <span className="db-big-rating">{metrics.avgRating}</span>
              <div className="db-rating-stars">
                {[1, 2, 3, 4, 5].map((n) => {
                  const avg = parseFloat(metrics.avgRating) || 0;
                  return (
                    <Star
                      key={n}
                      size={18}
                      fill={n <= Math.round(avg) ? '#FFC107' : 'none'}
                      stroke="#FFC107"
                      strokeWidth={1.5}
                    />
                  );
                })}
              </div>
              <span className="db-review-count">
                {metrics.reviewCount} {metrics.reviewCount === 1 ? 'review' : 'reviews'}
              </span>
            </div>

            {reviews.length === 0 && (
              <p className="db-review-empty">No reviews yet. Share your business profile to get started!</p>
            )}

            {/* Preview last 3 reviews */}
            {reviews.slice(0, 3).map((rv) => (
              <div key={rv.id} className="db-review-item">
                <div className="db-rv-header">
                  <span className="db-rv-author">{rv.customerName || 'Anonymous'}</span>
                  <div className="db-rv-stars">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={11}
                        fill={i < rv.rating ? '#FFC107' : 'none'}
                        stroke="#FFC107"
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>
                </div>
                {rv.comment && <p className="db-rv-comment">{rv.comment}</p>}
              </div>
            ))}
            {reviews.length > 0 && (
              <button
                className="btn-primary"
                onClick={() => navigate('/reviews')}
                style={{ width: '100%', marginTop: '16px', fontSize: '0.8rem', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <MessageSquare size={13} />
                Manage &amp; Reply to Reviews
              </button>
            )}
          </section>
        </aside>
      </div>

      {/* ─── Inline CSS ─────────────────────────────────────────────────── */}
      <style>{`
        /* ─── Wrapper ─────────────────────────────────────────── */
        .db-wrapper {
          display: flex;
          flex-direction: column;
          gap: 28px;
          max-width: 1300px;
          margin: 0 auto;
          padding-bottom: 60px;
        }

        /* ─── Header ──────────────────────────────────────────── */
        .db-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .db-header-left {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .db-eyebrow {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--primary);
        }

        .db-title {
          font-size: 2rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0;
          line-height: 1.15;
        }

        .db-header-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .db-category-pill {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 3px 10px;
          background: rgba(108,99,255,0.12);
          border: 1px solid rgba(108,99,255,0.25);
          border-radius: 50px;
          color: var(--primary);
        }

        .db-status-pill {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 50px;
        }

        .db-status-pill.open {
          background: rgba(0,230,180,0.1);
          border: 1px solid rgba(0,230,180,0.3);
          color: var(--teal);
        }

        .db-status-pill.closed {
          background: rgba(239,83,80,0.1);
          border: 1px solid rgba(239,83,80,0.3);
          color: #EF5350;
        }

        .db-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .db-status-pill.open .db-status-dot  { background: var(--teal); }
        .db-status-pill.closed .db-status-dot { background: #EF5350; }

        /* Live badge */
        .db-live-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: rgba(0, 230, 180, 0.1);
          border: 1px solid rgba(0, 230, 180, 0.3);
          border-radius: 50px;
          color: var(--teal);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          flex-shrink: 0;
          animation: db-pulse 2.5s ease-in-out infinite;
        }

        @keyframes db-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.55; }
        }

        /* ─── Stat Grid ───────────────────────────────────────── */
        .db-stat-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 16px;
        }

        @media (max-width: 1200px) {
          .db-stat-grid { grid-template-columns: repeat(3, 1fr); }
        }

        @media (max-width: 640px) {
          .db-stat-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .db-stat-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 16px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .db-stat-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 30px rgba(108,99,255,0.12);
        }

        .db-stat-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          flex-shrink: 0;
          background: rgba(108,99,255,0.12);
        }

        .db-stat-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .db-stat-value {
          font-size: 1.5rem;
          font-weight: 800;
          line-height: 1.1;
          white-space: nowrap;
        }

        .db-stat-label {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .db-stat-sub {
          font-size: 0.68rem;
          color: var(--text-secondary);
        }

        /* ─── Lower Grid ──────────────────────────────────────── */
        .db-lower-grid {
          display: grid;
          grid-template-columns: 1.65fr 1fr;
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 1024px) {
          .db-lower-grid { grid-template-columns: 1fr; }
        }

        .db-main-col,
        .db-sidebar-col {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* ─── Section Card ────────────────────────────────────── */
        .db-section-card {
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .db-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--glass-border);
        }

        .db-sh-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .db-sh-icon {
          color: var(--primary);
          flex-shrink: 0;
        }

        .db-section-header h2 {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .db-sh-count,
        .db-queue-total-badge {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 50px;
          background: rgba(108,99,255,0.1);
          border: 1px solid rgba(108,99,255,0.25);
          color: var(--primary);
        }

        /* ─── Now Serving ─────────────────────────────────────── */
        .db-now-serving-row {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 14px 16px;
          background: rgba(108,99,255,0.06);
          border: 1px solid rgba(108,99,255,0.18);
          border-radius: var(--border-radius-md);
          flex-wrap: wrap;
        }

        .db-ns-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--primary);
          flex-shrink: 0;
        }

        .db-ns-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--primary);
          animation: db-blink 1.2s ease-in-out infinite;
        }

        @keyframes db-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }

        .db-ns-info {
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1;
        }

        .db-ns-token {
          font-size: 1.4rem;
          font-weight: 800;
          color: var(--primary);
          letter-spacing: 0.04em;
          line-height: 1;
        }

        .db-ns-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .db-ns-name {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .db-ns-service {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .db-ns-empty {
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-style: italic;
        }

        /* ─── Queue List ──────────────────────────────────────── */
        .db-queue-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .db-queue-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          transition: background 0.2s;
        }

        .db-queue-item:hover {
          background: rgba(255,255,255,0.04);
        }

        .db-qi-pos {
          font-size: 0.85rem;
          font-weight: 800;
          color: var(--primary);
          min-width: 28px;
        }

        .db-qi-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .db-qi-name {
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .db-qi-service {
          font-size: 0.72rem;
          color: var(--text-secondary);
        }

        .db-qi-right {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          color: var(--teal);
          font-weight: 600;
          flex-shrink: 0;
        }

        .db-queue-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 24px;
          color: var(--text-secondary);
          font-size: 0.85rem;
          text-align: center;
        }

        .db-queue-empty p { margin: 0; }

        .db-queue-empty-icon { opacity: 0.35; }

        /* ─── Booking List Table ──────────────────────────────── */
        .db-booking-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .db-bl-header {
          display: grid;
          grid-template-columns: 2fr 1.5fr 1fr 1fr 0.8fr;
          gap: 12px;
          padding: 6px 10px;
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
        }

        .db-bl-row {
          display: grid;
          grid-template-columns: 2fr 1.5fr 1fr 1fr 0.8fr;
          gap: 12px;
          align-items: center;
          padding: 10px;
          border-radius: var(--border-radius-md);
          transition: background 0.15s;
        }

        .db-bl-row:hover {
          background: rgba(255,255,255,0.03);
        }

        .db-bl-customer {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .db-bl-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--teal));
          color: #fff;
          font-size: 0.8rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .db-bl-name {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .db-bl-token {
          display: block;
          font-size: 0.68rem;
          color: var(--primary);
          font-weight: 600;
        }

        .db-bl-service {
          font-size: 0.82rem;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .db-bl-date {
          display: flex;
          flex-direction: column;
          gap: 1px;
          font-size: 0.78rem;
          color: var(--text-primary);
        }

        .db-bl-time {
          font-size: 0.68rem;
          color: var(--text-secondary);
        }

        .db-bl-status {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 3px 8px;
          border-radius: 50px;
          white-space: nowrap;
          text-align: center;
        }

        .db-bl-price {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--teal);
          text-align: right;
        }

        @media (max-width: 700px) {
          .db-bl-header { display: none; }
          .db-bl-row    { grid-template-columns: 1fr 1fr; gap: 8px; }
        }

        /* ─── Quick Actions ───────────────────────────────────── */
        .db-qa-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .db-quick-action {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          text-align: left;
          width: 100%;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          backdrop-filter: blur(16px);
          color: var(--text-primary);
          font-size: 0.9rem;
          font-weight: 600;
        }

        .db-quick-action:hover {
          transform: translateX(4px);
          border-color: var(--qa-accent, var(--primary));
          box-shadow: 0 4px 20px rgba(108,99,255,0.1);
        }

        .db-qa-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          flex-shrink: 0;
        }

        .db-qa-arrow {
          margin-left: auto;
          color: var(--text-secondary);
          flex-shrink: 0;
          transition: transform 0.2s;
        }

        .db-quick-action:hover .db-qa-arrow {
          transform: translateX(3px);
          color: var(--qa-accent, var(--primary));
        }

        /* ─── Rating Summary ──────────────────────────────────── */
        .db-rating-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px 0 8px;
        }

        .db-big-rating {
          font-size: 3rem;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1;
        }

        .db-rating-stars {
          display: flex;
          gap: 3px;
        }

        .db-review-count {
          font-size: 0.78rem;
          color: var(--text-secondary);
        }

        .db-review-empty {
          font-size: 0.82rem;
          color: var(--text-secondary);
          text-align: center;
          font-style: italic;
          margin: 0;
        }

        .db-review-item {
          padding: 12px 0;
          border-top: 1px solid var(--glass-border);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .db-rv-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .db-rv-author {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .db-rv-stars {
          display: flex;
          gap: 2px;
        }

        .db-rv-comment {
          font-size: 0.78rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.45;
        }

        /* ─── State screens ───────────────────────────────────── */
        .db-state-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 60px 32px;
          text-align: center;
          max-width: 480px;
          margin: 60px auto;
        }

        .db-state-center h2 {
          font-size: 1.35rem;
          color: var(--text-primary);
          margin: 0;
        }

        .db-state-center p {
          color: var(--text-secondary);
          font-size: 0.88rem;
          margin: 0;
          line-height: 1.5;
        }

        .db-state-icon-warn    { color: #FFC107; }
        .db-state-icon-primary { color: var(--primary); }

        .db-state-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          border-radius: 50px;
          font-size: 0.9rem;
          margin-top: 8px;
        }

        /* ─── Skeleton ────────────────────────────────────────── */
        .db-skeleton {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.04) 25%,
            rgba(255,255,255,0.09) 50%,
            rgba(255,255,255,0.04) 75%
          );
          background-size: 200% 100%;
          animation: db-shimmer 1.4s ease-in-out infinite;
          border-radius: 6px;
          width: 100%;
          height: 14px;
        }

        @keyframes db-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .db-skel-header {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
      `}</style>
    </div>
  );
};

export default BusinessDashboard;
