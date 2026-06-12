import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  runTransaction,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import useAuth from '../../hooks/useAuth';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Building2,
  Scissors,
  Hash,
  AlertTriangle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Banknote,
  Star,
  Inbox,
  MessageSquare,
  Navigation,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  pending:   { bg: 'rgba(255,193,7,0.1)',   border: 'rgba(255,193,7,0.4)',   text: '#FFC107' },
  confirmed: { bg: 'rgba(108,99,255,0.1)',  border: 'rgba(108,99,255,0.4)',  text: 'var(--primary)' },
  active:    { bg: 'rgba(0,230,180,0.1)',   border: 'rgba(0,230,180,0.4)',   text: 'var(--teal)' },
  cancelled: { bg: 'rgba(239,83,80,0.1)',   border: 'rgba(239,83,80,0.4)',   text: '#EF5350' },
  served:    { bg: 'rgba(76,175,80,0.1)',   border: 'rgba(76,175,80,0.4)',   text: '#4CAF50' },
};

const STATUS_LABELS = {
  pending:   'Pending',
  confirmed: 'Confirmed',
  active:    'In Service',
  cancelled: 'Cancelled',
  served:    'Completed',
};

const PAYMENT_LABELS = {
  pending:  'Pay at Venue',
  paid:     'Paid',
  failed:   'Failed',
  refunded: 'Refunded',
};

const PAYMENT_COLORS = {
  pending:  '#FFC107',
  paid:     '#4CAF50',
  failed:   '#EF5350',
  refunded: '#90CAF9',
};

const formatDateTime = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  {
    key: 'active',
    label: 'Active',
    filter: (b) => ['pending', 'active'].includes(b.status),
    emptyMsg: 'No active bookings right now.',
  },
  {
    key: 'upcoming',
    label: 'Upcoming',
    filter: (b) => b.status === 'confirmed',
    emptyMsg: 'No upcoming appointments scheduled.',
  },
  {
    key: 'completed',
    label: 'Completed',
    filter: (b) => b.status === 'served',
    emptyMsg: 'No completed appointments yet.',
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    filter: (b) => b.status === 'cancelled',
    emptyMsg: "No cancelled bookings.",
  },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = ({ style = {} }) => (
  <div className="ap-skeleton" style={style} />
);

const BookingCardSkeleton = () => (
  <div className="glass-panel ap-booking-card">
    <div className="ap-card-top">
      <Skeleton style={{ width: 90, height: 22, borderRadius: 50 }} />
      <Skeleton style={{ width: 70, height: 14 }} />
    </div>
    <Skeleton style={{ width: '55%', height: 20, margin: '12px 0 6px' }} />
    <Skeleton style={{ width: '35%', height: 14 }} />
    <div className="ap-card-grid">
      {[1,2,3,4].map(i => <Skeleton key={i} style={{ height: 38, borderRadius: 6 }} />)}
    </div>
    <Skeleton style={{ height: 36, borderRadius: 50, marginTop: 8 }} />
  </div>
);

// ─── Booking Card ─────────────────────────────────────────────────────────────
const BookingCard = ({ booking, onCancel, cancellingId, navigate, onReview, reviewedBookingIds }) => {
  const statusStyle  = STATUS_COLORS[booking.status]  || STATUS_COLORS.pending;
  const isCancelling = cancellingId === booking.id;
  const canCancel    = booking.status === 'confirmed';
  const canViewQueue = ['pending', 'active'].includes(booking.status);

  return (
    <div className={`glass-panel ap-booking-card ${isCancelling ? 'ap-card-cancelling' : ''}`}>
      {/* Top row: status chip + token */}
      <div className="ap-card-top">
        <span
          className="ap-status-chip"
          style={{
            background: statusStyle.bg,
            border: `1px solid ${statusStyle.border}`,
            color: statusStyle.text,
          }}
        >
          {booking.status === 'pending' || booking.status === 'active'
            ? <span className="ap-chip-dot" style={{ background: statusStyle.text }} />
            : null}
          {STATUS_LABELS[booking.status] || booking.status}
        </span>

        <span className="ap-token">
          <Hash size={12} />
          {booking.tokenNumber || '—'}
        </span>
      </div>

      {/* Business + Service */}
      <div className="ap-card-biz">
        <h3 className="ap-biz-name">{booking.businessName}</h3>
        <p className="ap-service-name">
          <Scissors size={12} />
          {booking.serviceName}
        </p>
      </div>

      {/* Info grid */}
      <div className="ap-card-grid">
        <div className="ap-info-cell">
          <span className="ap-info-label">
            <CalendarDays size={11} /> Date &amp; Time
          </span>
          <span className="ap-info-value">{formatDateTime(booking.dateTime)}</span>
        </div>
        <div className="ap-info-cell">
          <span className="ap-info-label">
            <Clock size={11} /> Queue Position
          </span>
          <span className="ap-info-value">
            {booking.queuePosition ? `#${booking.queuePosition}` : '—'}
          </span>
        </div>
        <div className="ap-info-cell">
          <span className="ap-info-label">
            <Banknote size={11} /> Price
          </span>
          <span className="ap-info-value ap-price">₹{booking.price}</span>
        </div>
        <div className="ap-info-cell">
          <span className="ap-info-label">
            <CheckCircle2 size={11} /> Payment
          </span>
          <span
            className="ap-info-value"
            style={{ color: PAYMENT_COLORS[booking.paymentStatus] || 'var(--text-primary)' }}
          >
            {PAYMENT_LABELS[booking.paymentStatus] || booking.paymentStatus || '—'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="ap-card-actions">
        {canViewQueue && (
          <button
            className="btn-primary ap-action-btn"
            onClick={() => navigate('/queue')}
          >
            <ChevronRight size={14} />
            View Queue
          </button>
        )}

        {booking.status !== 'cancelled' && booking.status !== 'served' && (
          <button
            className="ap-outline-btn"
            onClick={() => navigate(`/smart-route/${booking.id}`)}
          >
            <Navigation size={13} style={{ color: 'var(--primary)' }} />
            Smart Route
          </button>
        )}

        {booking.status === 'served' && (
          <>
            <button
              className="ap-outline-btn"
              onClick={() => navigate(`/business/${booking.businessId}`)}
            >
              Book Again
            </button>
            {reviewedBookingIds.has(booking.id) ? (
              <button className="ap-outline-btn" disabled style={{ opacity: 0.7, cursor: 'default' }}>
                <CheckCircle2 size={14} style={{ color: '#4CAF50' }} />
                Reviewed
              </button>
            ) : (
              <button
                className="btn-primary ap-action-btn"
                onClick={() => onReview(booking)}
              >
                <Star size={14} />
                Write Review
              </button>
            )}
          </>
        )}

        {canCancel && (
          <button
            className="ap-cancel-btn"
            onClick={() => onCancel(booking)}
            disabled={isCancelling}
          >
            {isCancelling
              ? <><Loader2 size={13} className="ap-spinner" /> Cancelling…</>
              : <><XCircle size={13} /> Cancel Booking</>}
          </button>
        )}
      </div>
    </div>
  );
};

// ─── MyAppointments Component ─────────────────────────────────────────────────
const MyAppointments = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [bookings, setBookings]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [activeTab, setActiveTab]     = useState('active');
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [toast, setToast]             = useState(null);

  // Review state
  const [reviewedBookingIds, setReviewedBookingIds] = useState(new Set());
  const [reviewTarget, setReviewTarget]             = useState(null);
  const [reviewRating, setReviewRating]             = useState(5);
  const [reviewText, setReviewText]                 = useState('');
  const [reviewSubmitting, setReviewSubmitting]     = useState(false);
  const [reviewError, setReviewError]               = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load already reviewed booking IDs
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'reviews'),
      where('customerId', '==', currentUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const ids = new Set(snap.docs.map(doc => doc.data().bookingId));
      setReviewedBookingIds(ids);
    }, (err) => {
      console.error("Error loading reviewed bookings:", err);
    });
    return () => unsub();
  }, [currentUser]);

  // ── Real-time listener for all bookings by this customer
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'bookings'),
      where('customerId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setBookings(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('MyAppointments: listener error', err);
        setError('Failed to load appointments. Please try again.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [currentUser]);

  // ── Cancel booking with Firestore transaction
  const handleCancel = useCallback(async (booking) => {
    const confirmed = window.confirm(
      `Cancel booking at ${booking.businessName}?\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    setCancellingId(booking.id);
    setCancelError('');

    try {
      const bookingRef = doc(db, 'bookings', booking.id);
      const queueRef   = doc(db, 'queues', booking.businessId);
      const businessRef = doc(db, 'businesses', booking.businessId);

      await runTransaction(db, async (tx) => {
        const [bSnap, qSnap, bizSnap] = await Promise.all([
          tx.get(bookingRef),
          tx.get(queueRef),
          tx.get(businessRef),
        ]);

        if (!bSnap.exists()) throw new Error('Booking not found.');
        if (bSnap.data().status !== 'confirmed') throw new Error('Only confirmed bookings can be cancelled.');

        // 1. Mark booking cancelled
        tx.update(bookingRef, {
          status: 'cancelled',
          updatedAt: new Date(),
        });

        // 2. Remove from queue & recalculate
        if (qSnap.exists()) {
          const qData = qSnap.data();
          const filtered = (qData.items || []).filter(
            (it) => it.bookingId !== booking.id
          );
          const recalculated = filtered.map((it, idx) => ({
            ...it,
            position:    idx + 1,
            waitMinutes: (idx + 1) * 10,
          }));

          tx.update(queueRef, {
            items:        recalculated,
            totalWaiting: recalculated.length,
            lastUpdated:  new Date(),
          });
        }

        // 3. Create Notification for Business Owner
        if (bizSnap.exists()) {
          const bizData = bizSnap.data();
          if (bizData.ownerId) {
            const notifRef = doc(collection(db, 'notifications'));
            tx.set(notifRef, {
              id: notifRef.id,
              userId: bizData.ownerId,
              title: 'Booking Cancelled',
              message: `${booking.customerName || 'A customer'} has cancelled their booking for ${booking.serviceName || 'service'}.`,
              body: `${booking.customerName || 'A customer'} has cancelled their booking for ${booking.serviceName || 'service'}.`,
              type: 'booking_cancelled',
              isRead: false,
              createdAt: new Date(),
              referenceId: booking.id
            });
          }
        }
      });

      showToast('Booking cancelled successfully.');
    } catch (err) {
      console.error('MyAppointments: cancel failed', err);
      setCancelError(err.message || 'Failed to cancel booking.');
      showToast(err.message || 'Failed to cancel booking.', 'error');
    } finally {
      setCancellingId(null);
    }
  }, []);

  // ── Submit review with Firestore transaction
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewTarget) return;

    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError('Please select a rating between 1 and 5 stars.');
      return;
    }

    setReviewSubmitting(true);
    setReviewError('');

    try {
      // 1. Double check for duplicate reviews
      const q = query(
        collection(db, 'reviews'),
        where('bookingId', '==', reviewTarget.id)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        throw new Error('You have already submitted a review for this booking.');
      }

      const reviewRef = doc(collection(db, 'reviews'));
      const businessRef = doc(db, 'businesses', reviewTarget.businessId);

      await runTransaction(db, async (tx) => {
        const bSnap = await tx.get(businessRef);
        if (!bSnap.exists()) {
          throw new Error('Business not found.');
        }

        const bData = bSnap.data();
        const oldCount = bData.reviewCount || 0;
        const oldRating = bData.rating || 0;

        const newCount = oldCount + 1;
        const newRating = ((oldRating * oldCount) + reviewRating) / newCount;
        const roundedRating = Math.round(newRating * 100) / 100;

        // Create the review doc (save both text and comment for full compatibility)
        tx.set(reviewRef, {
          id: reviewRef.id,
          businessId: reviewTarget.businessId,
          bookingId: reviewTarget.id,
          customerId: currentUser.uid,
          customerName: reviewTarget.customerName || currentUser.displayName || 'Anonymous',
          serviceName: reviewTarget.serviceName || '',
          rating: reviewRating,
          text: reviewText.trim(),
          comment: reviewText.trim(),
          createdAt: new Date(),
        });

        // Update the business rating and count
        tx.update(businessRef, {
          rating: roundedRating,
          reviewCount: newCount,
        });
      });

      showToast('Review submitted successfully!');
      setReviewTarget(null);
      setReviewRating(5);
      setReviewText('');
    } catch (err) {
      console.error('Submit review failed:', err);
      setReviewError(err.message || 'Failed to submit review.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  // ── Filtered bookings for the active tab
  const currentTab   = TABS.find((t) => t.key === activeTab);
  const tabBookings  = (currentTab?.filter ? bookings.filter(currentTab.filter) : bookings);
  const tabCounts    = {};
  TABS.forEach((t) => {
    tabCounts[t.key] = bookings.filter(t.filter).length;
  });

  // ── Loading skeletons
  if (loading) {
    return (
      <div className="ap-wrapper animate-fade-in">
        <div className="ap-header">
          <Skeleton style={{ width: 80, height: 14, borderRadius: 4 }} />
          <Skeleton style={{ width: 260, height: 34, marginTop: 10 }} />
        </div>
        <div className="ap-tabs-skeleton">
          {[1,2,3,4].map(i => <Skeleton key={i} style={{ width: 90, height: 36, borderRadius: 50 }} />)}
        </div>
        <div className="ap-list">
          {[1,2,3].map(i => <BookingCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  // ── Error
  if (error) {
    return (
      <div className="ap-state-center glass-panel animate-fade-in">
        <AlertTriangle size={44} className="ap-icon-warn" />
        <h2>Could Not Load Appointments</h2>
        <p>{error}</p>
        <button className="btn-primary ap-state-btn" onClick={() => window.location.reload()}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`ap-toast ${toast.type} animate-fade-in`}>
          {toast.type === 'success'
            ? <CheckCircle2 size={15} />
            : <AlertTriangle size={15} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="ap-wrapper animate-fade-in">
        {/* Header */}
        <header className="ap-header">
          <button className="ap-back-btn" onClick={() => navigate('/home')}>
            <ArrowLeft size={15} /> Home
          </button>
          <span className="ap-eyebrow">
            <CalendarDays size={13} /> Bookings
          </span>
          <h1 className="ap-title">My Appointments</h1>
          <p className="ap-subtitle">
            {bookings.length} total booking{bookings.length !== 1 ? 's' : ''} on your account
          </p>
        </header>

        {/* Tabs */}
        <div className="ap-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`ap-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab.key); setCancelError(''); }}
            >
              {tab.label}
              {tabCounts[tab.key] > 0 && (
                <span className={`ap-tab-count ${activeTab === tab.key ? 'active' : ''}`}>
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Cancel error banner */}
        {cancelError && (
          <div className="ap-cancel-error animate-fade-in">
            <AlertTriangle size={14} />
            <span>{cancelError}</span>
          </div>
        )}

        {/* Bookings list */}
        {tabBookings.length === 0 ? (
          <div className="ap-empty-state glass-panel animate-fade-in">
            <Inbox size={44} className="ap-empty-icon" />
            <h2>Nothing Here Yet</h2>
            <p>{currentTab?.emptyMsg}</p>
            {activeTab === 'active' && (
              <button
                className="btn-primary ap-state-btn"
                onClick={() => navigate('/home')}
              >
                <Building2 size={14} />
                Browse Businesses
              </button>
            )}
          </div>
        ) : (
          <div className="ap-list">
            {tabBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onCancel={handleCancel}
                cancellingId={cancellingId}
                navigate={navigate}
                onReview={setReviewTarget}
                reviewedBookingIds={reviewedBookingIds}
              />
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewTarget && (
        <div className="ap-modal-overlay animate-fade-in" onClick={() => setReviewTarget(null)}>
          <div className="glass-panel ap-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ap-modal-header">
              <h2>Write a Review</h2>
              <button className="ap-close-btn" onClick={() => setReviewTarget(null)}>×</button>
            </div>
            
            <form onSubmit={handleSubmitReview} className="ap-modal-form">
              <p className="ap-modal-sub">
                Share your experience at <strong>{reviewTarget.businessName}</strong> for the service <strong>{reviewTarget.serviceName}</strong>.
              </p>
              
              <div className="ap-rating-picker">
                <span className="ap-rating-picker-label">Your Rating</span>
                <div className="ap-stars-picker">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="ap-star-btn"
                      onClick={() => setReviewRating(star)}
                    >
                      <Star
                        size={28}
                        fill={star <= reviewRating ? '#FFBD59' : 'none'}
                        stroke={star <= reviewRating ? 'none' : '#FFBD59'}
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                </div>
                <span className="ap-rating-value-desc">
                  {reviewRating === 5 && 'Excellent! 😍'}
                  {reviewRating === 4 && 'Good! 🙂'}
                  {reviewRating === 3 && 'Average. 😐'}
                  {reviewRating === 2 && 'Poor. 🙁'}
                  {reviewRating === 1 && 'Terrible. 😠'}
                </span>
              </div>
              
              <div className="ap-form-group">
                <label className="ap-form-label">Review Comment (Optional)</label>
                <textarea
                  className="ap-textarea"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Tell others about the quality of service, safety, cleanliness, or waiting experience..."
                  rows={4}
                  maxLength={500}
                />
                <span className="ap-char-count">{reviewText.length}/500</span>
              </div>
              
              {reviewError && (
                <div className="ap-modal-error animate-fade-in">
                  <AlertTriangle size={14} />
                  <span>{reviewError}</span>
                </div>
              )}
              
              <div className="ap-modal-actions">
                <button
                  type="button"
                  className="ap-outline-btn"
                  onClick={() => setReviewTarget(null)}
                  disabled={reviewSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary ap-action-btn"
                  disabled={reviewSubmitting}
                >
                  {reviewSubmitting ? (
                    <>
                      <Loader2 size={14} className="ap-spinner" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Review'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Scoped Styles ─────────────────────────────────────────────────── */}
      <style>{`
        /* Wrapper */
        .ap-wrapper {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 780px;
          margin: 0 auto;
          padding-bottom: 60px;
        }

        /* Header */
        .ap-header {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .ap-back-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          align-self: flex-start;
          transition: color 0.2s;
        }
        .ap-back-btn:hover { color: var(--primary); }

        .ap-eyebrow {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--primary);
        }
        .ap-title {
          font-size: 1.9rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0;
        }
        .ap-subtitle {
          font-size: 0.88rem;
          color: var(--text-secondary);
          margin: 0;
        }

        /* Tabs */
        .ap-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .ap-tab-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 18px;
          border-radius: 50px;
          border: 1px solid var(--glass-border);
          background: rgba(255,255,255,0.03);
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .ap-tab-btn:hover {
          border-color: rgba(108,99,255,0.35);
          color: var(--text-primary);
        }
        .ap-tab-btn.active {
          background: rgba(108,99,255,0.12);
          border-color: rgba(108,99,255,0.45);
          color: var(--primary);
        }
        .ap-tab-count {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 50px;
          background: rgba(255,255,255,0.06);
          color: var(--text-secondary);
        }
        .ap-tab-count.active {
          background: rgba(108,99,255,0.2);
          color: var(--primary);
        }

        /* Cancel error */
        .ap-cancel-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 8px;
          background: rgba(239,83,80,0.08);
          border: 1px solid rgba(239,83,80,0.25);
          color: #EF5350;
          font-size: 0.82rem;
          font-weight: 600;
        }

        /* List */
        .ap-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Booking Card */
        .ap-booking-card {
          padding: 20px 22px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: opacity 0.3s;
        }
        .ap-booking-card.ap-card-cancelling {
          opacity: 0.6;
          pointer-events: none;
        }

        .ap-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .ap-status-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 11px;
          border-radius: 50px;
        }
        .ap-chip-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          animation: ap-blink 1.8s ease-in-out infinite;
        }
        @keyframes ap-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }

        .ap-token {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text-secondary);
          font-family: monospace;
          letter-spacing: 0.04em;
        }

        .ap-card-biz {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .ap-biz-name {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }
        .ap-service-name {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.82rem;
          color: var(--text-secondary);
          margin: 0;
        }

        /* Info grid */
        .ap-card-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        @media (max-width: 540px) {
          .ap-card-grid { grid-template-columns: 1fr; }
        }
        .ap-info-cell {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 10px 12px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
        }
        .ap-info-label {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.68rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .ap-info-value {
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .ap-price { color: var(--teal); }

        /* Actions */
        .ap-card-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .ap-action-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: 50px;
          font-size: 0.82rem;
          font-weight: 700;
        }
        .ap-outline-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: 50px;
          font-size: 0.82rem;
          font-weight: 700;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--glass-border);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
        }
        .ap-outline-btn:hover {
          border-color: rgba(108,99,255,0.35);
          background: rgba(108,99,255,0.06);
          color: var(--primary);
        }
        .ap-cancel-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 50px;
          font-size: 0.82rem;
          font-weight: 700;
          background: rgba(239,83,80,0.08);
          border: 1px solid rgba(239,83,80,0.25);
          color: #EF5350;
          cursor: pointer;
          transition: all 0.2s;
        }
        .ap-cancel-btn:hover:not(:disabled) {
          background: rgba(239,83,80,0.14);
          border-color: rgba(239,83,80,0.4);
        }
        .ap-cancel-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Empty state */
        .ap-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          padding: 60px 32px;
          text-align: center;
        }
        .ap-empty-icon { color: var(--text-secondary); opacity: 0.5; }
        .ap-empty-state h2 {
          font-size: 1.2rem;
          color: var(--text-primary);
          margin: 0;
        }
        .ap-empty-state p {
          color: var(--text-secondary);
          font-size: 0.88rem;
          margin: 0;
          line-height: 1.5;
        }

        /* Tabs skeleton */
        .ap-tabs-skeleton {
          display: flex;
          gap: 8px;
        }

        /* Error state */
        .ap-state-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 60px 32px;
          text-align: center;
          max-width: 460px;
          margin: 60px auto;
        }
        .ap-state-center h2 { font-size: 1.3rem; color: var(--text-primary); margin: 0; }
        .ap-state-center p  { color: var(--text-secondary); font-size: 0.88rem; margin: 0; }
        .ap-icon-warn { color: #FFC107; }
        .ap-state-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          border-radius: 50px;
          font-size: 0.9rem;
          margin-top: 8px;
        }

        /* Toast */
        .ap-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          z-index: 1100;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          animation: ap-slide-in 0.3s ease;
        }
        @keyframes ap-slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ap-toast.success {
          background: rgba(76,175,80,0.1);
          border: 1px solid rgba(76,175,80,0.35);
          color: #4CAF50;
          backdrop-filter: blur(8px);
        }
        .ap-toast.error {
          background: rgba(239,83,80,0.1);
          border: 1px solid rgba(239,83,80,0.35);
          color: #EF5350;
          backdrop-filter: blur(8px);
        }

        /* Skeleton */
        .ap-skeleton {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.04) 25%,
            rgba(255,255,255,0.09) 50%,
            rgba(255,255,255,0.04) 75%
          );
          background-size: 200% 100%;
          animation: ap-shimmer 1.4s ease-in-out infinite;
          border-radius: 4px;
          width: 100%;
          height: 14px;
        }
        @keyframes ap-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .ap-spinner {
          animation: ap-spin 1s linear infinite;
        }
        @keyframes ap-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Modal Overlay */
        .ap-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(10, 8, 20, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .ap-modal-card {
          width: 100%;
          max-width: 500px;
          padding: 24px;
          border-radius: var(--border-radius-lg);
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .ap-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ap-modal-header h2 {
          font-size: 1.35rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0;
        }

        .ap-close-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 1.8rem;
          font-weight: 300;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          transition: color 0.2s;
        }

        .ap-close-btn:hover {
          color: var(--primary);
        }

        .ap-modal-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .ap-modal-sub {
          font-size: 0.88rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        /* Rating picker */
        .ap-rating-picker {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
          border: 1px solid var(--glass-border);
        }

        .ap-rating-picker-label {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
        }

        .ap-stars-picker {
          display: flex;
          gap: 8px;
        }

        .ap-star-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          transition: transform 0.15s ease;
        }

        .ap-star-btn:hover {
          transform: scale(1.15);
        }

        .ap-rating-value-desc {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--primary);
          height: 18px;
        }

        /* Form Group */
        .ap-form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ap-form-label {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .ap-textarea {
          width: 100%;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          color: var(--text-primary);
          padding: 12px;
          font-size: 0.9rem;
          resize: none;
          outline: none;
          transition: border-color 0.2s;
          font-family: inherit;
        }

        .ap-textarea:focus {
          border-color: rgba(108, 99, 255, 0.45);
        }

        .ap-char-count {
          font-size: 0.72rem;
          color: var(--text-secondary);
          align-self: flex-end;
        }

        .ap-modal-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: rgba(239, 83, 80, 0.08);
          border: 1px solid rgba(239, 83, 80, 0.25);
          color: #EF5350;
          font-size: 0.82rem;
          font-weight: 600;
          border-radius: 6px;
        }

        .ap-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 8px;
        }
      `}</style>
    </>
  );
};

export default MyAppointments;
