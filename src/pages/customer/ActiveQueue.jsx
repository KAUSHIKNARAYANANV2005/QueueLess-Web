import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  getDocs,
  addDoc,
} from 'firebase/firestore';
import { calculateFallbackRoute } from '../../services/maps/googleMapsService';
import { db } from '../../firebase/config';
import { useBooking } from '../../context/BookingContext';
import useAuth from '../../hooks/useAuth';
import {
  ArrowLeft,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Clock,
  Users,
  Hash,
  Building2,
  Scissors,
  CalendarDays,
  XCircle,
  RefreshCw,
  Star,
  Wifi,
  Navigation,
} from 'lucide-react';

// ─── Status helpers ─────────────────────────────────────────────────────────
const STATUS_COLORS = {
  pending:   { bg: 'rgba(255,193,7,0.12)',  border: 'rgba(255,193,7,0.4)',  text: '#FFC107' },
  confirmed: { bg: 'rgba(108,99,255,0.12)', border: 'rgba(108,99,255,0.4)', text: 'var(--primary)' },
  active:    { bg: 'rgba(0,230,180,0.12)',  border: 'rgba(0,230,180,0.4)',  text: 'var(--teal)' },
  cancelled: { bg: 'rgba(239,83,80,0.12)',  border: 'rgba(239,83,80,0.4)',  text: '#EF5350' },
  served:    { bg: 'rgba(76,175,80,0.12)',  border: 'rgba(76,175,80,0.4)',  text: '#4CAF50' },
};

const STATUS_LABELS = {
  pending:   'Pending',
  confirmed: 'Confirmed',
  active:    'In Service',
  cancelled: 'Cancelled',
  served:    'Completed',
};

const PAYMENT_LABELS = {
  pending:   'Pay at Venue',
  paid:      'Paid',
  failed:    'Payment Failed',
  refunded:  'Refunded',
};

const formatDateTime = (ts) => {
  if (!ts) return '—';
  try {
    let d;
    if (typeof ts.toDate === 'function') {
      d = ts.toDate();
    } else if (ts.seconds !== undefined) {
      d = new Date(ts.seconds * 1000);
    } else {
      d = new Date(ts);
    }
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch (err) {
    console.error("ActiveQueue formatDateTime error:", err);
    return '—';
  }
};

// ─── Skeleton ────────────────────────────────────────────────────────────────
const Skeleton = ({ className = '', style = {} }) => (
  <div className={`aq-skeleton ${className}`} style={style} />
);

// ─── ActiveQueue Component ───────────────────────────────────────────────────
const ActiveQueue = () => {
  const navigate = useNavigate();
  const { bookingId, clearBookingState } = useBooking();
  const { currentUser } = useAuth();

  // ── state
  const [resolvedBookingId, setResolvedBookingId] = useState(bookingId || null);
  const [booking, setBooking]     = useState(null);
  const [queueDoc, setQueueDoc]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [resolving, setResolving] = useState(!bookingId); // need to query Firestore first?
  const [error, setError]         = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [cancelled, setCancelled]     = useState(false);
  const [businessDoc, setBusinessDoc] = useState(null);

  // ─── Derived: live queue position ────────────────────────────────────────
  const livePosition = React.useMemo(() => {
    if (!queueDoc?.items || !resolvedBookingId) return null;
    const item = queueDoc.items.find((it) => it.bookingId === resolvedBookingId);
    return item?.position ?? null;
  }, [queueDoc, resolvedBookingId]);

  const liveWait = React.useMemo(() => {
    if (!queueDoc?.items || !resolvedBookingId) return null;
    const item = queueDoc.items.find((it) => it.bookingId === resolvedBookingId);
    return item?.waitMinutes ?? null;
  }, [queueDoc, resolvedBookingId]);

  // ─── Step 1, 2, 3, 4: Resolve bookingId and Listen ──────────────────────────
  useEffect(() => {
    const isMock = bookingId?.startsWith('mock-') || localStorage.getItem('mockBooking') || currentUser?.uid?.startsWith('mock-');
    if (isMock) {
      const saved = localStorage.getItem('mockBooking');
      if (saved) {
        const parsed = JSON.parse(saved);
        setResolvedBookingId(parsed.id);
        setBooking(parsed);
        setQueueDoc({
          businessId: parsed.businessId,
          items: [
            {
              bookingId: parsed.id,
              customerName: parsed.customerName,
              serviceName: parsed.serviceName,
              position: 1,
              status: 'waiting',
              waitMinutes: 10
            }
          ]
        });
        setBusinessDoc({
          id: parsed.businessId,
          name: parsed.businessName,
          lat: 40.7128,
          lng: -74.0060
        });
      } else {
        setBooking(null);
        setQueueDoc(null);
      }
      setResolving(false);
      setLoading(false);
      return;
    }

    if (bookingId) {
      setResolvedBookingId(bookingId);
      setResolving(false);
      return;
    }

    if (!currentUser) {
      setResolving(false);
      setLoading(false);
      return;
    }

    // Query for latest active booking without orderBy to avoid requiring a composite index
    const q = query(
      collection(db, 'bookings'),
      where('customerId', '==', currentUser.uid),
      where('status', 'in', ['pending', 'confirmed', 'active'])
    );

    getDocs(q)
      .then((snap) => {
        if (!snap.empty) {
          const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // Sort client-side by createdAt desc
          docs.sort((a, b) => {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return timeB - timeA;
          });
          setResolvedBookingId(docs[0].id);
        } else {
          setLoading(false);
        }
        setResolving(false);
      })
      .catch((err) => {
        console.error('ActiveQueue: failed to resolve bookingId', err);
        setError('Could not load your booking. Please try again.');
        setResolving(false);
        setLoading(false);
      });
  }, [bookingId, currentUser]);

  // Real-time listener for non-mock sessions
  useEffect(() => {
    const isMock = resolvedBookingId?.startsWith('mock-') || localStorage.getItem('mockBooking');
    if (isMock || !resolvedBookingId || resolving) return;

    const unsub = onSnapshot(
      doc(db, 'bookings', resolvedBookingId),
      (snap) => {
        if (!snap.exists()) {
          setError('Booking not found.');
          setLoading(false);
          return;
        }
        setBooking({ id: snap.id, ...snap.data() });
        setLoading(false);
      },
      (err) => {
        console.error('ActiveQueue: booking listener error', err);
        setError('Real-time update failed. Check your connection.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [resolvedBookingId, resolving]);

  // Live queue listener for non-mock sessions
  useEffect(() => {
    const isMock = booking?.id?.startsWith('mock-') || localStorage.getItem('mockBooking');
    if (isMock || !booking?.businessId) return;

    const unsub = onSnapshot(
      doc(db, 'queues', booking.businessId),
      (snap) => {
        if (snap.exists()) {
          setQueueDoc({ id: snap.id, ...snap.data() });
        } else {
          setQueueDoc(null);
        }
      },
      (err) => {
        console.error('ActiveQueue: queue listener error', err);
      }
    );

    return () => unsub();
  }, [booking?.businessId]);

  // Live business coordinates listener for non-mock sessions
  useEffect(() => {
    const isMock = booking?.id?.startsWith('mock-') || localStorage.getItem('mockBooking');
    if (isMock || !booking?.businessId) return;

    const unsub = onSnapshot(
      doc(db, 'businesses', booking.businessId),
      (snap) => {
        if (snap.exists()) {
          setBusinessDoc({ id: snap.id, ...snap.data() });
        }
      }
    );
    return () => unsub();
  }, [booking?.businessId]);

  // ─── Step 5: Live Geolocation Notification Reminder Check ────────────────
  const [notifTriggered, setNotifTriggered] = useState(false);

  useEffect(() => {
    if (!currentUser || !booking || !businessDoc || livePosition === null || notifTriggered) return;

    const businessLat = businessDoc.lat;
    const businessLng = businessDoc.lng;
    if (!businessLat || !businessLng) return;

    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        const { durationMins } = calculateFallbackRoute(userLat, userLng, businessLat, businessLng);
        const bufferMins = 10;
        const waitTime = liveWait || (livePosition * 10);

        if (waitTime <= durationMins + bufferMins) {
          setNotifTriggered(true);

          try {
            // Prevent duplicates
            const q = query(
              collection(db, 'notifications'),
              where('userId', '==', currentUser.uid),
              where('referenceId', '==', booking.id),
              where('type', '==', 'travel_reminder')
            );
            const snap = await getDocs(q);
            if (snap.empty) {
              await addDoc(collection(db, 'notifications'), {
                userId: currentUser.uid,
                referenceId: booking.id,
                title: "Time to Start Moving",
                message: `Start now. Your turn is approaching. Estimated travel time is ${durationMins} minutes.`,
                body: `Start now. Your turn is approaching. Estimated travel time is ${durationMins} minutes.`,
                type: "travel_reminder",
                isRead: false,
                createdAt: new Date(),
              });
              console.log("Smart travel reminder created inside ActiveQueue.");
            }
          } catch (e) {
            console.error("Error creating active queue travel notification:", e);
          }
        }
      },
      (err) => console.warn("ActiveQueue Geolocation warning:", err),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [currentUser, booking, businessDoc, livePosition, liveWait, notifTriggered]);



  // ─── Cancel Booking ──────────────────────────────────────────────────────
  const handleCancel = useCallback(async () => {
    if (!resolvedBookingId || !booking?.businessId || cancelling) return;

    const confirmed = window.confirm(
      'Are you sure you want to cancel this booking? This action cannot be undone.'
    );
    if (!confirmed) return;

    setCancelling(true);
    setCancelError(null);

    const isMock = resolvedBookingId?.startsWith('mock-') || localStorage.getItem('mockBooking');
    if (isMock) {
      localStorage.removeItem('mockBooking');
      setBooking(null);
      setQueueDoc(null);
      setCancelled(true);
      clearBookingState();
      setCancelling(false);
      return;
    }

    try {
      const bookingRef = doc(db, 'bookings', resolvedBookingId);
      const queueRef   = doc(db, 'queues', booking.businessId);

      await runTransaction(db, async (transaction) => {
        const [bSnap, qSnap] = await Promise.all([
          transaction.get(bookingRef),
          transaction.get(queueRef),
        ]);

        if (!bSnap.exists()) throw new Error('Booking not found.');
        if (bSnap.data().status === 'cancelled') throw new Error('Already cancelled.');

        // 1. Mark booking as cancelled
        transaction.update(bookingRef, {
          status: 'cancelled',
          updatedAt: new Date(),
        });

        // 2. Remove from queue and recalculate
        if (qSnap.exists()) {
          const qData = qSnap.data();
          const filtered = (qData.items || []).filter(
            (it) => it.bookingId !== resolvedBookingId
          );
          // Recalculate positions and waitMinutes
          const recalculated = filtered.map((it, idx) => ({
            ...it,
            position: idx + 1,
            waitMinutes: (idx + 1) * 10,
          }));

          transaction.update(queueRef, {
            items: recalculated,
            totalWaiting: recalculated.length,
            lastUpdated: new Date(),
          });
        }
      });

      setCancelled(true);
      clearBookingState();
    } catch (err) {
      console.error('ActiveQueue: cancel failed', err);
      setCancelError(err.message || 'Failed to cancel booking. Please try again.');
    } finally {
      setCancelling(false);
    }
  }, [resolvedBookingId, booking, cancelling, clearBookingState]);

  // ─── Status badge ────────────────────────────────────────────────────────
  const statusStyle = STATUS_COLORS[booking?.status] || STATUS_COLORS.pending;

  // ─── Empty state: no booking ─────────────────────────────────────────────
  const renderEmpty = () => (
    <div className="aq-empty-state glass-panel animate-fade-in">
      <Star size={48} className="aq-empty-icon" />
      <h2>No Active Booking</h2>
      <p>You don't have any active or pending bookings right now.</p>
      <button className="btn-primary aq-action-btn" onClick={() => navigate('/home')}>
        Browse Businesses
      </button>
    </div>
  );

  // ─── Cancelled success state ─────────────────────────────────────────────
  const renderCancelled = () => (
    <div className="aq-empty-state glass-panel animate-fade-in">
      <XCircle size={48} className="aq-cancel-icon" />
      <h2>Booking Cancelled</h2>
      <p>Your booking has been successfully cancelled. We hope to serve you again soon.</p>
      <button className="btn-primary aq-action-btn" onClick={() => navigate('/home')}>
        Back to Home
      </button>
    </div>
  );

  // ─── Error state ─────────────────────────────────────────────────────────
  const renderError = () => (
    <div className="aq-empty-state glass-panel animate-fade-in">
      <AlertTriangle size={48} className="aq-error-icon" />
      <h2>Something Went Wrong</h2>
      <p>{error}</p>
      <button className="btn-primary aq-action-btn" onClick={() => window.location.reload()}>
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  );

  // ─── Skeleton loader ─────────────────────────────────────────────────────
  const renderSkeleton = () => (
    <div className="aq-wrapper animate-fade-in">
      <div className="aq-header">
        <Skeleton style={{ width: 60, height: 18, borderRadius: 6 }} />
        <Skeleton style={{ width: 240, height: 32, borderRadius: 6, marginTop: 12 }} />
        <Skeleton style={{ width: 180, height: 14, borderRadius: 4, marginTop: 6 }} />
      </div>
      <div className="aq-grid">
        <div className="aq-main">
          {[1, 2].map((k) => (
            <div key={k} className="glass-panel aq-section-card">
              <Skeleton style={{ width: '40%', height: 16, marginBottom: 16 }} />
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} style={{ height: 14, marginBottom: 10, borderRadius: 4 }} />
              ))}
            </div>
          ))}
        </div>
        <div className="aq-sidebar">
          <div className="glass-panel aq-section-card">
            <Skeleton style={{ height: 80, borderRadius: 12, marginBottom: 16 }} />
            <Skeleton style={{ height: 14, marginBottom: 8 }} />
            <Skeleton style={{ height: 14, width: '70%' }} />
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Render ──────────────────────────────────────────────────────────────
  if (loading || resolving) return renderSkeleton();
  if (cancelled)            return renderCancelled();
  if (error)                return renderError();
  if (!booking)             return renderEmpty();

  const isCancellable = ['pending', 'confirmed'].includes(booking.status);
  const isCompleted   = ['cancelled', 'served'].includes(booking.status);
  const isNavigateActive = ['pending', 'confirmed', 'active'].includes(booking.status);

  return (
    <div className="aq-wrapper animate-fade-in">

      {/* ── Header ── */}
      <header className="aq-header">
        <button className="back-link-btn" onClick={() => navigate('/home')}>
          <ArrowLeft size={16} />
          <span>Home</span>
        </button>
        <div className="aq-header-row">
          <div>
            <span className="step-indicator">Live Tracking</span>
            <h1 className="aq-title">Your Queue Status</h1>
            <p className="aq-subtitle">{booking.businessName}</p>
          </div>
          {/* Live indicator */}
          <div className="aq-live-badge">
            <Wifi size={12} />
            <span>LIVE</span>
          </div>
        </div>
      </header>

      {/* ── Grid ── */}
      <div className="aq-grid">

        {/* ── Main column ── */}
        <main className="aq-main">

          {/* Booking Details Card */}
          <section className="glass-panel aq-section-card">
            <div className="aq-section-header">
              <CalendarDays size={16} />
              <h2>Booking Details</h2>
              {/* Status chip */}
              <span
                className="aq-status-chip"
                style={{
                  background: statusStyle.bg,
                  border: `1px solid ${statusStyle.border}`,
                  color: statusStyle.text,
                }}
              >
                {STATUS_LABELS[booking.status] || booking.status}
              </span>
            </div>

            <div className="aq-details-grid">
              <div className="aq-detail-item">
                <span className="aq-detail-label">Token Number</span>
                <span className="aq-detail-value aq-token">{booking.tokenNumber || '—'}</span>
              </div>
              <div className="aq-detail-item">
                <span className="aq-detail-label">Payment</span>
                <span className="aq-detail-value">
                  {PAYMENT_LABELS[booking.paymentStatus] || booking.paymentStatus || '—'}
                </span>
              </div>
              <div className="aq-detail-item">
                <span className="aq-detail-label">Service</span>
                <span className="aq-detail-value">{booking.serviceName || '—'}</span>
              </div>
              <div className="aq-detail-item">
                <span className="aq-detail-label">Staff</span>
                <span className="aq-detail-value">
                  {booking.staffId ? (booking.staffName || booking.staffId) : 'Any Available'}
                </span>
              </div>
              <div className="aq-detail-item aq-full-width">
                <span className="aq-detail-label">Date &amp; Time</span>
                <span className="aq-detail-value">{formatDateTime(booking.dateTime)}</span>
              </div>
              <div className="aq-detail-item">
                <span className="aq-detail-label">Price</span>
                <span className="aq-detail-value aq-price">₹{booking.price}</span>
              </div>
            </div>
          </section>

          {/* Queue Position Card */}
          {!isCompleted && (
            <section className="glass-panel aq-section-card">
              <div className="aq-section-header">
                <Users size={16} />
                <h2>Live Queue Position</h2>
              </div>

              <div className="aq-queue-stats">
                {/* Position */}
                <div className="aq-stat-block aq-stat-primary">
                  <Hash size={20} className="aq-stat-icon" />
                  <span className="aq-stat-number">
                    {livePosition !== null ? `#${livePosition}` : '—'}
                  </span>
                  <span className="aq-stat-label">Your Position</span>
                </div>

                {/* Wait time */}
                <div className="aq-stat-block">
                  <Clock size={20} className="aq-stat-icon aq-stat-teal" />
                  <span className="aq-stat-number aq-stat-teal">
                    {liveWait !== null ? `~${liveWait}` : '—'}
                  </span>
                  <span className="aq-stat-label">Min. Wait</span>
                </div>

                {/* Total in queue */}
                <div className="aq-stat-block">
                  <Users size={20} className="aq-stat-icon" />
                  <span className="aq-stat-number">
                    {queueDoc?.totalWaiting ?? '—'}
                  </span>
                  <span className="aq-stat-label">Total Waiting</span>
                </div>
              </div>

              {/* Progress bar */}
              {livePosition !== null && queueDoc?.totalWaiting > 0 && (
                <div className="aq-progress-wrap">
                  <div className="aq-progress-bar">
                    <div
                      className="aq-progress-fill"
                      style={{
                        width: `${Math.max(
                          5,
                          100 - ((livePosition - 1) / queueDoc.totalWaiting) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="aq-progress-label">
                    {livePosition === 1
                      ? "You're next!"
                      : `${livePosition - 1} ahead of you`}
                  </span>
                </div>
              )}
            </section>
          )}

          {/* Completion state */}
          {booking.status === 'served' && (
            <section className="glass-panel aq-section-card aq-served-card">
              <CheckCircle2 size={32} className="aq-served-icon" />
              <h2>Service Completed!</h2>
              <p>Thank you for using Queueless. We hope you enjoyed the service.</p>
              <button className="btn-primary aq-action-btn" onClick={() => navigate('/home')}>
                Book Again
              </button>
            </section>
          )}
        </main>

        {/* ── Sidebar ── */}
        <aside className="aq-sidebar">
          {/* Now Serving */}
          <section className="glass-panel aq-section-card aq-serving-card">
            <div className="aq-section-header">
              <Scissors size={16} />
              <h2>Now Serving</h2>
            </div>

            {queueDoc?.currentServingToken ? (
              <div className="aq-serving-info">
                <span className="aq-serving-token">{queueDoc.currentServingToken}</span>
                <span className="aq-serving-name">{queueDoc.currentServingName || '—'}</span>
                <span className="aq-serving-service">{queueDoc.currentServingService || '—'}</span>
              </div>
            ) : (
              <p className="aq-serving-empty">No one currently being served</p>
            )}
          </section>

          {/* Business Info */}
          <section className="glass-panel aq-section-card">
            <div className="aq-section-header">
              <Building2 size={16} />
              <h2>Venue</h2>
            </div>
            <p className="aq-venue-name">{booking.businessName}</p>
            <button
              className="aq-venue-link"
              onClick={() => navigate(`/business/${booking.businessId}`)}
            >
              View Business Profile →
            </button>
          </section>

          {/* Navigate Smartly CTA */}
          {isNavigateActive && (
            <section className="glass-panel aq-section-card" style={{ border: '1px solid rgba(108, 99, 255, 0.25)' }}>
              <div className="aq-section-header">
                <Navigation size={16} style={{ color: 'var(--primary)' }} />
                <h2>Smart Travel</h2>
              </div>
              <button
                className="btn-primary aq-action-btn"
                onClick={() => navigate(`/smart-route/${resolvedBookingId}`)}
                style={{ width: '100%', margin: 0, justifyContent: 'center' }}
              >
                <Navigation size={14} /> Navigate Smartly
              </button>
              <p className="aq-cancel-hint" style={{ marginTop: 4 }}>
                Departure alerts matched to traffic and live queue wait time.
              </p>
            </section>
          )}

          {/* Cancel / actions */}
          {isCancellable && (
            <section className="glass-panel aq-section-card">
              {cancelError && (
                <div className="aq-cancel-error">
                  <AlertTriangle size={14} />
                  <span>{cancelError}</span>
                </div>
              )}
              <button
                className="aq-cancel-btn"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? (
                  <><Loader2 size={14} className="spinner" /> Cancelling…</>
                ) : (
                  <><XCircle size={14} /> Cancel Booking</>
                )}
              </button>
              <p className="aq-cancel-hint">
                Cancellation is free. This action cannot be undone.
              </p>
            </section>
          )}
        </aside>
      </div>

      {/* ── Inline Styles ── */}
      <style>{`
        /* ─── Layout ─────────────────────────────────────────────────────── */
        .aq-wrapper {
          display: flex;
          flex-direction: column;
          gap: 28px;
          max-width: 1200px;
          margin: 0 auto;
          padding-bottom: 60px;
        }

        /* ─── Header ─────────────────────────────────────────────────────── */
        .aq-header {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .aq-header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .aq-title {
          font-size: 1.85rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 6px 0 2px;
        }

        .aq-subtitle {
          font-size: 0.95rem;
          color: var(--text-secondary);
          margin: 0;
        }

        /* Live badge */
        .aq-live-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(0, 230, 180, 0.1);
          border: 1px solid rgba(0, 230, 180, 0.35);
          border-radius: 50px;
          color: var(--teal);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          flex-shrink: 0;
          margin-top: 8px;
          animation: aq-pulse 2.5s ease-in-out infinite;
        }

        @keyframes aq-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.6; }
        }

        /* ─── Grid ───────────────────────────────────────────────────────── */
        .aq-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 900px) {
          .aq-grid { grid-template-columns: 1fr; }
        }

        .aq-main, .aq-sidebar {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ─── Section Card ───────────────────────────────────────────────── */
        .aq-section-card {
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .aq-section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--glass-border);
        }

        .aq-section-header svg {
          color: var(--primary);
          flex-shrink: 0;
        }

        .aq-section-header h2 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
          flex: 1;
        }

        /* Status chip */
        .aq-status-chip {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 4px 10px;
          border-radius: 50px;
        }

        /* ─── Details Grid ───────────────────────────────────────────────── */
        .aq-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .aq-detail-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .aq-full-width {
          grid-column: span 2;
        }

        .aq-detail-label {
          font-size: 0.72rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .aq-detail-value {
          font-size: 0.92rem;
          color: var(--text-primary);
          font-weight: 600;
        }

        .aq-token {
          font-size: 1.05rem;
          color: var(--primary);
          letter-spacing: 0.04em;
        }

        .aq-price {
          color: var(--teal);
          font-size: 1rem;
        }

        /* ─── Queue Stats ────────────────────────────────────────────────── */
        .aq-queue-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .aq-stat-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 16px 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          text-align: center;
          transition: border-color 0.2s;
        }

        .aq-stat-primary {
          border-color: rgba(108,99,255,0.35);
          background: rgba(108,99,255,0.06);
        }

        .aq-stat-icon {
          color: var(--text-secondary);
        }

        .aq-stat-icon.aq-stat-teal {
          color: var(--teal);
        }

        .aq-stat-number {
          font-size: 1.6rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1;
        }

        .aq-stat-number.aq-stat-teal {
          color: var(--teal);
        }

        .aq-stat-label {
          font-size: 0.7rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        /* ─── Progress Bar ───────────────────────────────────────────────── */
        .aq-progress-wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .aq-progress-bar {
          height: 8px;
          background: rgba(255,255,255,0.06);
          border-radius: 50px;
          overflow: hidden;
          border: 1px solid var(--glass-border);
        }

        .aq-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary), var(--teal));
          border-radius: 50px;
          transition: width 0.6s ease;
        }

        .aq-progress-label {
          font-size: 0.78rem;
          color: var(--text-secondary);
          text-align: center;
        }

        /* ─── Served / Completed Card ────────────────────────────────────── */
        .aq-served-card {
          align-items: center;
          text-align: center;
          padding: 36px 24px;
        }

        .aq-served-icon {
          color: #4CAF50;
        }

        .aq-served-card h2 {
          font-size: 1.3rem;
          color: var(--text-primary);
          margin: 0;
        }

        .aq-served-card p {
          color: var(--text-secondary);
          margin: 0;
          font-size: 0.88rem;
        }

        /* ─── Now Serving Card ───────────────────────────────────────────── */
        .aq-serving-card {
          background: rgba(108,99,255,0.04);
          border-color: rgba(108,99,255,0.2);
        }

        .aq-serving-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 16px 0 4px;
          text-align: center;
        }

        .aq-serving-token {
          font-size: 2rem;
          font-weight: 800;
          color: var(--primary);
          letter-spacing: 0.04em;
          line-height: 1;
        }

        .aq-serving-name {
          font-size: 0.95rem;
          color: var(--text-primary);
          font-weight: 600;
        }

        .aq-serving-service {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .aq-serving-empty {
          font-size: 0.85rem;
          color: var(--text-secondary);
          text-align: center;
          margin: 8px 0;
        }

        /* ─── Venue Card ─────────────────────────────────────────────────── */
        .aq-venue-name {
          font-size: 1rem;
          color: var(--text-primary);
          font-weight: 600;
          margin: 0;
        }

        .aq-venue-link {
          background: none;
          border: none;
          color: var(--primary);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          text-decoration: none;
          transition: opacity 0.2s;
        }

        .aq-venue-link:hover {
          opacity: 0.75;
        }

        /* ─── Cancel Button ──────────────────────────────────────────────── */
        .aq-cancel-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 16px;
          background: rgba(239,83,80,0.06);
          border: 1px solid rgba(239,83,80,0.35);
          border-radius: 50px;
          color: #EF5350;
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .aq-cancel-btn:hover:not(:disabled) {
          background: rgba(239,83,80,0.14);
          border-color: rgba(239,83,80,0.6);
        }

        .aq-cancel-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .aq-cancel-hint {
          font-size: 0.72rem;
          color: var(--text-secondary);
          text-align: center;
          margin: 0;
        }

        .aq-cancel-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          background: rgba(239,83,80,0.08);
          border: 1px solid rgba(239,83,80,0.25);
          border-radius: var(--border-radius-md);
          color: #EF5350;
          font-size: 0.78rem;
        }

        /* ─── Empty / Error States ───────────────────────────────────────── */
        .aq-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 56px 32px;
          text-align: center;
          max-width: 500px;
          margin: 60px auto;
        }

        .aq-empty-state h2 {
          font-size: 1.35rem;
          color: var(--text-primary);
          margin: 0;
        }

        .aq-empty-state p {
          color: var(--text-secondary);
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .aq-empty-icon   { color: var(--primary); }
        .aq-cancel-icon  { color: #EF5350; }
        .aq-error-icon   { color: #FFC107; }

        .aq-action-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          border-radius: 50px;
          font-size: 0.9rem;
          margin-top: 8px;
        }

        /* ─── Skeleton ───────────────────────────────────────────────────── */
        .aq-skeleton {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.04) 25%,
            rgba(255,255,255,0.08) 50%,
            rgba(255,255,255,0.04) 75%
          );
          background-size: 200% 100%;
          animation: aq-shimmer 1.4s ease-in-out infinite;
          border-radius: 6px;
          width: 100%;
        }

        @keyframes aq-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* back btn */
        .back-link-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          align-self: flex-start;
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s;
        }

        .back-link-btn:hover {
          color: var(--primary);
        }

        .step-indicator {
          font-size: 0.75rem;
          color: var(--primary);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        /* spinner */
        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ActiveQueue;
