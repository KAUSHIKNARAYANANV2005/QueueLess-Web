import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import useAuth from '../../hooks/useAuth';
import {
  ListOrdered,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  SkipForward,
  Wifi,
  Building2,
  Play,
  BadgeCheck,
  Trash2,
  Hash,
  ChevronRight,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const recalcItems = (items) =>
  items.map((it, idx) => ({
    ...it,
    position: idx + 1,
    waitMinutes: (idx + 1) * 10,
  }));

const Skeleton = ({ style = {} }) => (
  <div className="qm-skeleton" style={style} />
);

// ─── Confirmation Modal ───────────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, title, message, confirmLabel, danger, onConfirm, onCancel, loading }) => {
  if (!isOpen) return null;
  return (
    <div className="qm-modal-overlay" onClick={onCancel}>
      <div className="qm-modal glass-panel animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className={`qm-modal-icon ${danger ? 'danger' : 'primary'}`}>
          {danger ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
        </div>
        <h3 className="qm-modal-title">{title}</h3>
        <p className="qm-modal-msg">{message}</p>
        <div className="qm-modal-actions">
          <button className="qm-modal-cancel" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className={`qm-modal-confirm ${danger ? 'danger' : 'primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 size={14} className="qm-spinner" /> : null}
            {confirmLabel}
          </button>
        </div>
        {loading && (
          <p className="qm-modal-loading">Processing transaction…</p>
        )}
      </div>
    </div>
  );
};

// ─── QueueManager ─────────────────────────────────────────────────────────────
const QueueManager = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // ── Core state ──────────────────────────────────────────────────────────
  const [businessId, setBusinessId]   = useState(null);
  const [bizName, setBizName]         = useState('');
  const [queueDoc, setQueueDoc]       = useState(null);
  const [bookings, setBookings]       = useState([]);

  const [resolvingBiz, setResolvingBiz] = useState(true);
  const [loadingData, setLoadingData]   = useState(true);
  const [error, setError]               = useState(null);

  // ── Action state ─────────────────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError]     = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // ── Modal state ──────────────────────────────────────────────────────────
  const [modal, setModal] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: '',
    danger: false,
    onConfirm: null,
  });

  // ── Step 1: Resolve businessId from ownerId ─────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
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
        const d = snap.docs[0];
        setBusinessId(d.id);
        setBizName(d.data()?.name || 'Your Business');
        setResolvingBiz(false);
      })
      .catch((err) => {
        console.error('QueueManager: resolve error', err);
        setError('Failed to load business profile.');
        setResolvingBiz(false);
        setLoadingData(false);
      });
  }, [currentUser]);

  // ── Step 2: Real-time listener on queues/{businessId} ──────────────────
  useEffect(() => {
    if (!businessId) return;
    const unsub = onSnapshot(
      doc(db, 'queues', businessId),
      (snap) => {
        setQueueDoc(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoadingData(false);
      },
      (err) => {
        console.error('QueueManager: queue listener error', err);
        setLoadingData(false);
      }
    );
    return () => unsub();
  }, [businessId]);

  // ── Step 3: Real-time listener on bookings where businessId == id ───────
  useEffect(() => {
    if (!businessId) return;
    const q = query(
      collection(db, 'bookings'),
      where('businessId', '==', businessId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('QueueManager: bookings listener error', err)
    );
    return () => unsub();
  }, [businessId]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const waitingItems = useMemo(() => {
    return [...(queueDoc?.items || [])]
      .filter((it) => it.status !== 'served')
      .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  }, [queueDoc]);

  const currentServingToken   = queueDoc?.currentServingToken || null;
  const currentServingName    = queueDoc?.currentServingName  || '';
  const currentServingService = queueDoc?.currentServingService || '';
  const totalWaiting          = queueDoc?.totalWaiting ?? 0;

  // Find the booking doc for the currently active/serving booking
  const activeBooking = useMemo(() => {
    if (!currentServingToken) return null;
    return bookings.find(
      (bk) => bk.tokenNumber === currentServingToken && bk.status === 'active'
    ) || null;
  }, [bookings, currentServingToken]);

  // ── Toast feedback ───────────────────────────────────────────────────────
  const showSuccess = (msg) => {
    setActionSuccess(msg);
    setActionError(null);
    setTimeout(() => setActionSuccess(null), 3500);
  };
  const showError = (msg) => {
    setActionError(msg);
    setTimeout(() => setActionError(null), 4000);
  };

  // ── Dismiss modal helper ────────────────────────────────────────────────
  const closeModal = () =>
    setModal({ open: false, title: '', message: '', confirmLabel: '', danger: false, onConfirm: null });

  // ── Generic modal opener ────────────────────────────────────────────────
  const openModal = ({ title, message, confirmLabel, danger, onConfirm }) =>
    setModal({ open: true, title, message, confirmLabel, danger, onConfirm });

  // ══════════════════════════════════════════════════════════════════════════
  // ACTION: Serve Next
  // ══════════════════════════════════════════════════════════════════════════
  const handleServeNext = useCallback(() => {
    if (!businessId || waitingItems.length === 0) return;
    const nextItem = waitingItems[0];
    openModal({
      title: 'Serve Next Customer?',
      message: `Call ${nextItem.customerName} (${nextItem.serviceName}) to the counter now?`,
      confirmLabel: 'Serve Next',
      danger: false,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const queueRef = doc(db, 'queues', businessId);
          const bookingRef = doc(db, 'bookings', nextItem.bookingId);

          await runTransaction(db, async (transaction) => {
            const [qSnap, bSnap] = await Promise.all([
              transaction.get(queueRef),
              transaction.get(bookingRef),
            ]);

            if (!qSnap.exists()) throw new Error('Queue document not found.');

            const qData   = qSnap.data();
            const items   = qData.items || [];

            // Remove first item (the one we're serving)
            const remaining = items.filter((it) => it.bookingId !== nextItem.bookingId);
            const recalculated = recalcItems(remaining);

            // Update queue doc
            transaction.update(queueRef, {
              currentServingToken:   bSnap.exists() ? (bSnap.data().tokenNumber || nextItem.bookingId) : nextItem.bookingId,
              currentServingName:    nextItem.customerName,
              currentServingService: nextItem.serviceName,
              items:                 recalculated,
              totalWaiting:          recalculated.length,
              lastUpdated:           serverTimestamp(),
            });

            // Update booking status to active
            if (bSnap.exists()) {
              const bData = bSnap.data();
              transaction.update(bookingRef, {
                status:    'active',
                updatedAt: serverTimestamp(),
              });

              // Create notification for customer (served!)
              if (bData.customerId) {
                const notifRef = doc(collection(db, 'notifications'));
                transaction.set(notifRef, {
                  id: notifRef.id,
                  userId: bData.customerId,
                  title: "It's Your Turn!",
                  message: `Please proceed to the counter. Your token ${bData.tokenNumber || ''} is now active at ${bizName || 'the venue'}.`,
                  body: `Please proceed to the counter. Your token ${bData.tokenNumber || ''} is now active at ${bizName || 'the venue'}.`,
                  type: 'queue_served',
                  isRead: false,
                  createdAt: new Date(),
                  referenceId: nextItem.bookingId
                });
              }
            }
          });

          showSuccess(`Now serving ${nextItem.customerName}!`);
        } catch (err) {
          console.error('ServeNext transaction failed', err);
          showError(err.message || 'Failed to serve next customer.');
        } finally {
          setActionLoading(false);
          closeModal();
        }
      },
    });
  }, [businessId, waitingItems]);

  // ══════════════════════════════════════════════════════════════════════════
  // ACTION: Mark Current as Served
  // ══════════════════════════════════════════════════════════════════════════
  const handleMarkServed = useCallback(() => {
    if (!businessId || !currentServingToken) return;
    openModal({
      title: 'Mark as Served?',
      message: `Mark ${currentServingName || 'the current customer'} as served and clear the serving slot?`,
      confirmLabel: 'Mark Served',
      danger: false,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const queueRef = doc(db, 'queues', businessId);

          await runTransaction(db, async (transaction) => {
            const qSnap = await transaction.get(queueRef);
            if (!qSnap.exists()) throw new Error('Queue document not found.');

            // Find the booking with this token
            const bookingMatch = bookings.find(
              (bk) => bk.tokenNumber === currentServingToken && bk.status === 'active'
            );

            // Clear serving fields on queue
            transaction.update(queueRef, {
              currentServingToken:   '',
              currentServingName:    '',
              currentServingService: '',
              lastUpdated:           serverTimestamp(),
            });

            // Update booking status to served
            if (bookingMatch) {
              const bookingRef = doc(db, 'bookings', bookingMatch.id);
              transaction.update(bookingRef, {
                status:    'served',
                updatedAt: serverTimestamp(),
              });
            }
          });

          showSuccess('Customer marked as served.');
        } catch (err) {
          console.error('MarkServed transaction failed', err);
          showError(err.message || 'Failed to mark as served.');
        } finally {
          setActionLoading(false);
          closeModal();
        }
      },
    });
  }, [businessId, currentServingToken, currentServingName, bookings]);

  // ══════════════════════════════════════════════════════════════════════════
  // ACTION: Skip Customer
  // ══════════════════════════════════════════════════════════════════════════
  const handleSkip = useCallback((item) => {
    if (!businessId) return;
    openModal({
      title: 'Skip Customer?',
      message: `Move ${item.customerName} to the end of the queue? They will be served last.`,
      confirmLabel: 'Skip',
      danger: true,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const queueRef = doc(db, 'queues', businessId);

          await runTransaction(db, async (transaction) => {
            const qSnap = await transaction.get(queueRef);
            if (!qSnap.exists()) throw new Error('Queue document not found.');

            const qData   = qSnap.data();
            const items   = qData.items || [];

            // Remove from current position and push to end
            const without = items.filter((it) => it.bookingId !== item.bookingId);
            const skipped = { ...item, status: 'waiting' };
            const reordered = recalcItems([...without, skipped]);

            transaction.update(queueRef, {
              items:       reordered,
              totalWaiting: reordered.length,
              lastUpdated: serverTimestamp(),
            });
          });

          showSuccess(`${item.customerName} moved to end of queue.`);
        } catch (err) {
          console.error('Skip transaction failed', err);
          showError(err.message || 'Failed to skip customer.');
        } finally {
          setActionLoading(false);
          closeModal();
        }
      },
    });
  }, [businessId]);

  // ══════════════════════════════════════════════════════════════════════════
  // ACTION: Remove Customer
  // ══════════════════════════════════════════════════════════════════════════
  const handleRemove = useCallback((item) => {
    if (!businessId) return;
    openModal({
      title: 'Remove Customer?',
      message: `Remove ${item.customerName} from the queue and cancel their booking? This cannot be undone.`,
      confirmLabel: 'Remove & Cancel',
      danger: true,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const queueRef   = doc(db, 'queues', businessId);
          const bookingRef = doc(db, 'bookings', item.bookingId);

          await runTransaction(db, async (transaction) => {
            const [qSnap, bSnap] = await Promise.all([
              transaction.get(queueRef),
              transaction.get(bookingRef),
            ]);

            if (!qSnap.exists()) throw new Error('Queue document not found.');

            const qData   = qSnap.data();
            const items   = qData.items || [];

            const remaining   = items.filter((it) => it.bookingId !== item.bookingId);
            const recalculated = recalcItems(remaining);

            transaction.update(queueRef, {
              items:        recalculated,
              totalWaiting: recalculated.length,
              lastUpdated:  serverTimestamp(),
            });

            if (bSnap.exists()) {
              const bData = bSnap.data();
              transaction.update(bookingRef, {
                status:    'cancelled',
                updatedAt: serverTimestamp(),
              });

              // Create notification for customer (cancelled by venue)
              if (bData.customerId) {
                const notifRef = doc(collection(db, 'notifications'));
                transaction.set(notifRef, {
                  id: notifRef.id,
                  userId: bData.customerId,
                  title: 'Booking Cancelled',
                  message: `Your appointment for ${bData.serviceName || 'service'} at ${bizName || 'the venue'} was cancelled by the venue.`,
                  body: `Your appointment for ${bData.serviceName || 'service'} at ${bizName || 'the venue'} was cancelled by the venue.`,
                  type: 'booking_cancelled',
                  isRead: false,
                  createdAt: new Date(),
                  referenceId: item.bookingId
                });
              }
            }
          });

          showSuccess(`${item.customerName} removed from queue.`);
        } catch (err) {
          console.error('Remove transaction failed', err);
          showError(err.message || 'Failed to remove customer.');
        } finally {
          setActionLoading(false);
          closeModal();
        }
      },
    });
  }, [businessId]);

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (resolvingBiz || (loadingData && !error)) {
    return (
      <div className="qm-wrapper animate-fade-in">
        <div className="qm-skel-header">
          <Skeleton style={{ width: 140, height: 13 }} />
          <Skeleton style={{ width: 280, height: 34, marginTop: 10 }} />
          <Skeleton style={{ width: 200, height: 13, marginTop: 8 }} />
        </div>
        <div className="qm-top-grid">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-panel qm-stat-card">
              <Skeleton style={{ width: 38, height: 38, borderRadius: 10 }} />
              <div style={{ flex: 1 }}>
                <Skeleton style={{ width: 56, height: 24, marginBottom: 6 }} />
                <Skeleton style={{ width: 80, height: 11 }} />
              </div>
            </div>
          ))}
        </div>
        <div className="glass-panel qm-section-card">
          <Skeleton style={{ height: 80, borderRadius: 10, marginBottom: 12 }} />
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} style={{ height: 60, borderRadius: 10, marginBottom: 10 }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="qm-state-center glass-panel animate-fade-in">
        <AlertTriangle size={44} className="qm-icon-warn" />
        <h2>Could not load queue</h2>
        <p>{error}</p>
        <button className="btn-primary qm-state-btn" onClick={() => window.location.reload()}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  // ── Empty – no queue document yet ────────────────────────────────────────
  const queueEmpty = !queueDoc && !loadingData;

  return (
    <>
      {/* ── Confirmation Modal ── */}
      <ConfirmModal
        isOpen={modal.open}
        title={modal.title}
        message={modal.message}
        confirmLabel={modal.confirmLabel}
        danger={modal.danger}
        onConfirm={modal.onConfirm}
        onCancel={closeModal}
        loading={actionLoading}
      />

      <div className="qm-wrapper animate-fade-in">

        {/* ── Header ── */}
        <header className="qm-header">
          <div className="qm-header-left">
            <button className="qm-back-btn" onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={15} />
              Dashboard
            </button>
            <span className="qm-eyebrow">
              <ListOrdered size={13} />
              Live Queue Manager
            </span>
            <h1 className="qm-title">{bizName}</h1>
          </div>
          <div className="qm-live-badge">
            <Wifi size={12} />
            <span>LIVE</span>
          </div>
        </header>

        {/* ── Toast notifications ── */}
        {actionSuccess && (
          <div className="qm-toast success animate-fade-in">
            <CheckCircle2 size={15} />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="qm-toast error animate-fade-in">
            <AlertTriangle size={15} />
            <span>{actionError}</span>
          </div>
        )}

        {/* ── Stat strip ── */}
        <div className="qm-top-grid">
          <div className="glass-panel qm-stat-card">
            <div className="qm-stat-icon" style={{ background: 'rgba(108,99,255,0.14)' }}>
              <Hash size={18} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <span className="qm-stat-num" style={{ color: 'var(--primary)' }}>
                {currentServingToken || '—'}
              </span>
              <span className="qm-stat-label">Now Serving</span>
            </div>
          </div>
          <div className="glass-panel qm-stat-card">
            <div className="qm-stat-icon" style={{ background: 'rgba(0,230,180,0.14)' }}>
              <Users size={18} style={{ color: 'var(--teal)' }} />
            </div>
            <div>
              <span className="qm-stat-num" style={{ color: 'var(--teal)' }}>
                {totalWaiting}
              </span>
              <span className="qm-stat-label">Total Waiting</span>
            </div>
          </div>
          <div className="glass-panel qm-stat-card">
            <div className="qm-stat-icon" style={{ background: 'rgba(76,175,80,0.14)' }}>
              <CheckCircle2 size={18} style={{ color: '#4CAF50' }} />
            </div>
            <div>
              <span className="qm-stat-num" style={{ color: '#4CAF50' }}>
                {bookings.filter((b) => b.status === 'served').length}
              </span>
              <span className="qm-stat-label">Served Today</span>
            </div>
          </div>
        </div>

        {/* ── Now Serving Panel + Primary Actions ── */}
        <section className="glass-panel qm-section-card qm-serving-panel">
          <div className="qm-section-header">
            <div className="qm-sh-left">
              <Play size={16} className="qm-sh-icon" />
              <h2>Now Serving</h2>
            </div>
            {/* Primary CTA row */}
            <div className="qm-primary-actions">
              <button
                className="qm-action-btn primary"
                onClick={handleServeNext}
                disabled={actionLoading || waitingItems.length === 0}
                title="Call next customer"
              >
                <SkipForward size={15} />
                Serve Next
              </button>
              <button
                className="qm-action-btn success"
                onClick={handleMarkServed}
                disabled={actionLoading || !currentServingToken}
                title="Mark current as served"
              >
                <BadgeCheck size={15} />
                Mark Served
              </button>
            </div>
          </div>

          {currentServingToken ? (
            <div className="qm-serving-hero">
              <div className="qm-serving-token-wrap">
                <span className="qm-serving-token">{currentServingToken}</span>
                <span className="qm-serving-tag">Currently Serving</span>
              </div>
              <div className="qm-serving-info">
                <span className="qm-serving-name">{currentServingName || '—'}</span>
                <span className="qm-serving-service">{currentServingService || '—'}</span>
              </div>
            </div>
          ) : (
            <div className="qm-serving-empty">
              <Users size={32} className="qm-serving-empty-icon" />
              <p>No one is currently being served.{waitingItems.length > 0 ? ' Press "Serve Next" to call the first customer.' : ''}</p>
            </div>
          )}
        </section>

        {/* ── Waiting Queue Table ── */}
        <section className="glass-panel qm-section-card">
          <div className="qm-section-header">
            <div className="qm-sh-left">
              <Users size={16} className="qm-sh-icon" />
              <h2>Waiting Queue</h2>
            </div>
            <span className="qm-total-badge">{waitingItems.length} waiting</span>
          </div>

          {queueEmpty || waitingItems.length === 0 ? (
            <div className="qm-table-empty">
              <Users size={36} className="qm-empty-icon" />
              <h3>Queue is Empty</h3>
              <p>No customers are currently waiting. New bookings will appear here automatically.</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="qm-table-head">
                <span>#</span>
                <span>Customer</span>
                <span>Service</span>
                <span>Wait</span>
                <span>Actions</span>
              </div>

              {/* Table rows */}
              <div className="qm-table-body">
                {waitingItems.map((item, idx) => (
                  <div
                    key={item.bookingId || idx}
                    className={`qm-table-row ${idx === 0 ? 'next-up' : ''}`}
                  >
                    {/* Position */}
                    <span className="qm-row-pos">
                      {idx === 0 ? (
                        <span className="qm-next-badge">
                          <ChevronRight size={11} />
                          Next
                        </span>
                      ) : (
                        `#${item.position}`
                      )}
                    </span>

                    {/* Customer */}
                    <div className="qm-row-customer">
                      <div className="qm-row-avatar">
                        {(item.customerName || '?')[0].toUpperCase()}
                      </div>
                      <div className="qm-row-cust-info">
                        <span className="qm-row-cust-name">{item.customerName || '—'}</span>
                        <span className="qm-row-booking-id">
                          {item.bookingId?.slice(0, 8) || ''}
                        </span>
                      </div>
                    </div>

                    {/* Service */}
                    <span className="qm-row-service">{item.serviceName || '—'}</span>

                    {/* Wait */}
                    <div className="qm-row-wait">
                      <Clock size={12} />
                      <span>~{item.waitMinutes ?? '?'} min</span>
                    </div>

                    {/* Actions */}
                    <div className="qm-row-actions">
                      <button
                        className="qm-row-btn skip"
                        onClick={() => handleSkip(item)}
                        disabled={actionLoading}
                        title="Skip to end of queue"
                      >
                        <SkipForward size={13} />
                        Skip
                      </button>
                      <button
                        className="qm-row-btn remove"
                        onClick={() => handleRemove(item)}
                        disabled={actionLoading}
                        title="Remove and cancel booking"
                      >
                        <Trash2 size={13} />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* ── Inline styles ── */}
        <style>{`
          /* ─── Wrapper ─────────────────────────────────────────── */
          .qm-wrapper {
            display: flex;
            flex-direction: column;
            gap: 24px;
            max-width: 1100px;
            margin: 0 auto;
            padding-bottom: 60px;
          }

          /* ─── Header ──────────────────────────────────────────── */
          .qm-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;
          }

          .qm-header-left {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .qm-back-btn {
            display: flex;
            align-items: center;
            gap: 5px;
            background: none;
            border: none;
            color: var(--text-secondary);
            font-size: 0.82rem;
            font-weight: 600;
            cursor: pointer;
            transition: color 0.2s;
            padding: 0;
            align-self: flex-start;
          }

          .qm-back-btn:hover { color: var(--primary); }

          .qm-eyebrow {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.72rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--primary);
          }

          .qm-title {
            font-size: 1.9rem;
            font-weight: 800;
            color: var(--text-primary);
            margin: 0;
            line-height: 1.15;
          }

          /* Live badge */
          .qm-live-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 7px 14px;
            background: rgba(0,230,180,0.1);
            border: 1px solid rgba(0,230,180,0.3);
            border-radius: 50px;
            color: var(--teal);
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            flex-shrink: 0;
            animation: qm-pulse 2.5s ease-in-out infinite;
          }

          @keyframes qm-pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.55; }
          }

          /* ─── Toast ───────────────────────────────────────────── */
          .qm-toast {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 18px;
            border-radius: var(--border-radius-md);
            font-size: 0.88rem;
            font-weight: 600;
            animation: qm-slide-in 0.3s ease;
          }

          @keyframes qm-slide-in {
            from { opacity: 0; transform: translateY(-8px); }
            to   { opacity: 1; transform: translateY(0); }
          }

          .qm-toast.success {
            background: rgba(76,175,80,0.1);
            border: 1px solid rgba(76,175,80,0.35);
            color: #4CAF50;
          }

          .qm-toast.error {
            background: rgba(239,83,80,0.1);
            border: 1px solid rgba(239,83,80,0.35);
            color: #EF5350;
          }

          /* ─── Stat Strip ──────────────────────────────────────── */
          .qm-top-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }

          @media (max-width: 640px) {
            .qm-top-grid { grid-template-columns: 1fr; }
          }

          .qm-stat-card {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 18px 16px;
            transition: transform 0.2s;
          }

          .qm-stat-card:hover { transform: translateY(-2px); }

          .qm-stat-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 42px;
            height: 42px;
            border-radius: 11px;
            flex-shrink: 0;
          }

          .qm-stat-num {
            display: block;
            font-size: 1.55rem;
            font-weight: 800;
            line-height: 1.1;
          }

          .qm-stat-label {
            display: block;
            font-size: 0.72rem;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin-top: 2px;
          }

          /* ─── Section Card ────────────────────────────────────── */
          .qm-section-card {
            padding: 22px;
            display: flex;
            flex-direction: column;
            gap: 18px;
          }

          .qm-section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding-bottom: 14px;
            border-bottom: 1px solid var(--glass-border);
            flex-wrap: wrap;
          }

          .qm-sh-left {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .qm-sh-icon { color: var(--primary); flex-shrink: 0; }

          .qm-section-header h2 {
            font-size: 1.05rem;
            font-weight: 700;
            color: var(--text-primary);
            margin: 0;
          }

          /* ─── Primary action buttons ──────────────────────────── */
          .qm-primary-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }

          .qm-action-btn {
            display: flex;
            align-items: center;
            gap: 7px;
            padding: 9px 18px;
            border-radius: 50px;
            font-size: 0.85rem;
            font-weight: 700;
            cursor: pointer;
            border: none;
            transition: all 0.2s ease;
          }

          .qm-action-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }

          .qm-action-btn.primary {
            background: linear-gradient(135deg, var(--primary), var(--primary-deep));
            color: #fff;
            box-shadow: 0 4px 14px rgba(108,99,255,0.35);
          }

          .qm-action-btn.primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(108,99,255,0.5);
          }

          .qm-action-btn.success {
            background: rgba(76,175,80,0.1);
            border: 1px solid rgba(76,175,80,0.4);
            color: #4CAF50;
          }

          .qm-action-btn.success:hover:not(:disabled) {
            background: rgba(76,175,80,0.18);
            transform: translateY(-2px);
          }

          /* ─── Now Serving Hero ────────────────────────────────── */
          .qm-serving-panel {
            background: rgba(108,99,255,0.04);
            border-color: rgba(108,99,255,0.2) !important;
          }

          .qm-serving-hero {
            display: flex;
            align-items: center;
            gap: 28px;
            padding: 18px 20px;
            background: rgba(108,99,255,0.07);
            border: 1px solid rgba(108,99,255,0.22);
            border-radius: var(--border-radius-md);
            flex-wrap: wrap;
          }

          .qm-serving-token-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            flex-shrink: 0;
          }

          .qm-serving-token {
            font-size: 2.6rem;
            font-weight: 900;
            color: var(--primary);
            letter-spacing: 0.04em;
            line-height: 1;
          }

          .qm-serving-tag {
            font-size: 0.62rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--primary);
            background: rgba(108,99,255,0.14);
            padding: 3px 8px;
            border-radius: 50px;
          }

          .qm-serving-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .qm-serving-name {
            font-size: 1.25rem;
            font-weight: 700;
            color: var(--text-primary);
          }

          .qm-serving-service {
            font-size: 0.88rem;
            color: var(--text-secondary);
          }

          .qm-serving-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            padding: 28px;
            text-align: center;
          }

          .qm-serving-empty-icon { opacity: 0.25; }

          .qm-serving-empty p {
            font-size: 0.88rem;
            color: var(--text-secondary);
            margin: 0;
          }

          /* ─── Queue table ─────────────────────────────────────── */
          .qm-total-badge {
            font-size: 0.72rem;
            font-weight: 700;
            padding: 3px 10px;
            border-radius: 50px;
            background: rgba(108,99,255,0.1);
            border: 1px solid rgba(108,99,255,0.25);
            color: var(--primary);
          }

          .qm-table-head {
            display: grid;
            grid-template-columns: 72px 2fr 1.5fr 100px 1fr;
            gap: 12px;
            padding: 6px 14px;
            font-size: 0.68rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--text-secondary);
          }

          @media (max-width: 700px) {
            .qm-table-head { display: none; }
          }

          .qm-table-body {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .qm-table-row {
            display: grid;
            grid-template-columns: 72px 2fr 1.5fr 100px 1fr;
            gap: 12px;
            align-items: center;
            padding: 12px 14px;
            background: rgba(255,255,255,0.02);
            border: 1px solid var(--glass-border);
            border-radius: var(--border-radius-md);
            transition: background 0.15s, border-color 0.15s;
          }

          .qm-table-row:hover {
            background: rgba(255,255,255,0.04);
          }

          .qm-table-row.next-up {
            border-color: rgba(108,99,255,0.35);
            background: rgba(108,99,255,0.05);
          }

          @media (max-width: 700px) {
            .qm-table-row {
              grid-template-columns: 1fr 1fr;
              gap: 8px;
            }
          }

          /* position */
          .qm-row-pos {
            font-size: 0.88rem;
            font-weight: 800;
            color: var(--primary);
          }

          .qm-next-badge {
            display: inline-flex;
            align-items: center;
            gap: 2px;
            font-size: 0.65rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            background: rgba(108,99,255,0.15);
            border: 1px solid rgba(108,99,255,0.35);
            color: var(--primary);
            padding: 3px 7px;
            border-radius: 50px;
            white-space: nowrap;
          }

          /* customer */
          .qm-row-customer {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
          }

          .qm-row-avatar {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--primary), var(--teal));
            color: #fff;
            font-size: 0.82rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .qm-row-cust-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-width: 0;
          }

          .qm-row-cust-name {
            font-size: 0.88rem;
            font-weight: 600;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .qm-row-booking-id {
            font-size: 0.66rem;
            color: var(--text-secondary);
            font-family: monospace;
          }

          /* service */
          .qm-row-service {
            font-size: 0.85rem;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* wait */
          .qm-row-wait {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 0.8rem;
            color: var(--teal);
            font-weight: 600;
          }

          /* row action buttons */
          .qm-row-actions {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
          }

          .qm-row-btn {
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 6px 12px;
            border-radius: 50px;
            font-size: 0.72rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.18s ease;
            border: none;
          }

          .qm-row-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }

          .qm-row-btn.skip {
            background: rgba(255,193,7,0.1);
            border: 1px solid rgba(255,193,7,0.35);
            color: #E6A800;
          }

          .qm-row-btn.skip:hover:not(:disabled) {
            background: rgba(255,193,7,0.2);
            transform: scale(1.03);
          }

          .qm-row-btn.remove {
            background: rgba(239,83,80,0.08);
            border: 1px solid rgba(239,83,80,0.3);
            color: #EF5350;
          }

          .qm-row-btn.remove:hover:not(:disabled) {
            background: rgba(239,83,80,0.18);
            transform: scale(1.03);
          }

          /* empty */
          .qm-table-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            padding: 48px 24px;
            text-align: center;
          }

          .qm-empty-icon { opacity: 0.25; color: var(--primary); }

          .qm-table-empty h3 {
            font-size: 1.1rem;
            color: var(--text-primary);
            margin: 0;
          }

          .qm-table-empty p {
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin: 0;
            max-width: 380px;
            line-height: 1.5;
          }

          /* ─── Modal ───────────────────────────────────────────── */
          .qm-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .qm-modal {
            padding: 32px;
            max-width: 440px;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 14px;
            text-align: center;
          }

          .qm-modal-icon {
            width: 52px;
            height: 52px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .qm-modal-icon.primary {
            background: rgba(108,99,255,0.14);
            color: var(--primary);
          }

          .qm-modal-icon.danger {
            background: rgba(239,83,80,0.12);
            color: #EF5350;
          }

          .qm-modal-title {
            font-size: 1.15rem;
            font-weight: 700;
            color: var(--text-primary);
            margin: 0;
          }

          .qm-modal-msg {
            font-size: 0.88rem;
            color: var(--text-secondary);
            margin: 0;
            line-height: 1.5;
          }

          .qm-modal-actions {
            display: flex;
            gap: 10px;
            margin-top: 6px;
            width: 100%;
          }

          .qm-modal-cancel {
            flex: 1;
            padding: 11px;
            border-radius: 50px;
            font-size: 0.88rem;
            font-weight: 600;
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--glass-border);
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.2s;
          }

          .qm-modal-cancel:hover:not(:disabled) {
            background: rgba(255,255,255,0.1);
          }

          .qm-modal-cancel:disabled { opacity: 0.5; cursor: not-allowed; }

          .qm-modal-confirm {
            flex: 1;
            padding: 11px;
            border-radius: 50px;
            font-size: 0.88rem;
            font-weight: 700;
            cursor: pointer;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: all 0.2s;
          }

          .qm-modal-confirm:disabled { opacity: 0.55; cursor: not-allowed; }

          .qm-modal-confirm.primary {
            background: linear-gradient(135deg, var(--primary), var(--primary-deep));
            color: #fff;
            box-shadow: 0 4px 14px rgba(108,99,255,0.35);
          }

          .qm-modal-confirm.danger {
            background: rgba(239,83,80,0.12);
            border: 1px solid rgba(239,83,80,0.4);
            color: #EF5350;
          }

          .qm-modal-confirm.danger:hover:not(:disabled) {
            background: rgba(239,83,80,0.22);
          }

          .qm-modal-loading {
            font-size: 0.75rem;
            color: var(--text-secondary);
            margin: 0;
            font-style: italic;
          }

          /* ─── State screens ───────────────────────────────────── */
          .qm-state-center {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            padding: 60px 32px;
            text-align: center;
            max-width: 460px;
            margin: 60px auto;
          }

          .qm-state-center h2 {
            font-size: 1.3rem;
            color: var(--text-primary);
            margin: 0;
          }

          .qm-state-center p {
            color: var(--text-secondary);
            font-size: 0.88rem;
            margin: 0;
            line-height: 1.5;
          }

          .qm-icon-warn { color: #FFC107; }

          .qm-state-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 24px;
            border-radius: 50px;
            font-size: 0.9rem;
            margin-top: 8px;
          }

          /* ─── Skeleton ────────────────────────────────────────── */
          .qm-skeleton {
            background: linear-gradient(
              90deg,
              rgba(255,255,255,0.04) 25%,
              rgba(255,255,255,0.09) 50%,
              rgba(255,255,255,0.04) 75%
            );
            background-size: 200% 100%;
            animation: qm-shimmer 1.4s ease-in-out infinite;
            border-radius: 6px;
            width: 100%;
            height: 14px;
          }

          @keyframes qm-shimmer {
            0%   { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }

          .qm-skel-header {
            display: flex;
            flex-direction: column;
            gap: 0;
          }

          /* spinner in modal confirm */
          .qm-spinner {
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            0%   { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </>
  );
};

export default QueueManager;
