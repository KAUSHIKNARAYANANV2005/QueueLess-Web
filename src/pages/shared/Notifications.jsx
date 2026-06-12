import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import useAuth from '../../hooks/useAuth';
import {
  Bell,
  CheckCircle2,
  XCircle,
  CalendarDays,
  MessageSquare,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Inbox,
  Trash2,
  ArrowLeft,
  Check,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatTime = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

// ─── Notification Item Icon Picker ──────────────────────────────────────────
const NotificationIcon = ({ type, isRead }) => {
  const size = 18;
  const colorClass = isRead ? 'nt-icon-read' : 'nt-icon-unread';

  switch (type) {
    case 'booking_created':
      return <CalendarDays size={size} className={`nt-icon nt-icon-blue ${colorClass}`} />;
    case 'booking_cancelled':
      return <XCircle size={size} className={`nt-icon nt-icon-red ${colorClass}`} />;
    case 'queue_served':
      return <CheckCircle2 size={size} className={`nt-icon nt-icon-green ${colorClass}`} />;
    case 'review_reply':
      return <MessageSquare size={size} className={`nt-icon nt-icon-purple ${colorClass}`} />;
    default:
      return <Bell size={size} className={`nt-icon ${colorClass}`} />;
  }
};

// ─── Skeleton Item ────────────────────────────────────────────────────────────
const SkeletonNotif = () => (
  <div className="glass-panel nt-item nt-skeleton">
    <div className="nt-skel-icon" />
    <div style={{ flex: 1 }}>
      <div className="nt-skel-line title" />
      <div className="nt-skel-line text" />
      <div className="nt-skel-line date" />
    </div>
  </div>
);

// ─── Notifications Component ─────────────────────────────────────────────────
const Notifications = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [filter, setFilter]               = useState('all'); // 'all' | 'unread'
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast]                 = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Real-time listener for notifications
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setNotifications(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Notifications listener error', err);
        setError('Failed to load notifications.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [currentUser]);

  // ── Actions
  const handleMarkAsRead = useCallback(async (id) => {
    try {
      const docRef = doc(db, 'notifications', id);
      await updateDoc(docRef, { isRead: true });
    } catch (err) {
      console.error('Failed to mark notification as read', err);
      showToast('Failed to update notification.', 'error');
    }
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;

    setActionLoading(true);
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        const docRef = doc(db, 'notifications', n.id);
        batch.update(docRef, { isRead: true });
      });
      await batch.commit();
      showToast('All notifications marked as read.');
    } catch (err) {
      console.error('Failed to mark all as read', err);
      showToast('Failed to update notifications.', 'error');
    } finally {
      setActionLoading(false);
    }
  }, [notifications]);

  const handleDelete = useCallback(async (id, e) => {
    e.stopPropagation(); // Avoid triggering card click
    try {
      const docRef = doc(db, 'notifications', id);
      await deleteDoc(docRef);
      showToast('Notification deleted.');
    } catch (err) {
      console.error('Failed to delete notification', err);
      showToast('Failed to delete notification.', 'error');
    }
  }, []);

  // Filtered notifications
  const filteredNotifs = filter === 'unread'
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const readCount   = notifications.length - unreadCount;

  // ── Loading state
  if (loading) {
    return (
      <div className="nt-wrapper animate-fade-in">
        <header className="nt-header">
          <div className="nt-skel-line back" />
          <div className="nt-skel-line header-title" />
        </header>
        <div className="nt-list">
          {[1, 2, 3].map((i) => (
            <SkeletonNotif key={i} />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state
  if (error) {
    return (
      <div className="nt-state-center glass-panel animate-fade-in">
        <AlertTriangle size={44} className="nt-icon-warn" />
        <h2>Could Not Load Notifications</h2>
        <p>{error}</p>
        <button className="btn-primary nt-state-btn" onClick={() => window.location.reload()}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`nt-toast ${toast.type} animate-fade-in`}>
          {toast.type === 'success'
            ? <CheckCircle2 size={15} />
            : <AlertTriangle size={15} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="nt-wrapper animate-fade-in">
        {/* Header */}
        <header className="nt-header">
          <button className="nt-back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={15} /> Back
          </button>
          <div className="nt-header-row">
            <div>
              <span className="nt-eyebrow">
                <Bell size={12} /> Live Updates
              </span>
              <h1 className="nt-title">Notifications</h1>
              <p className="nt-subtitle">
                You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            </div>
            
            {unreadCount > 0 && (
              <button
                className="ap-outline-btn nt-read-all-btn"
                onClick={handleMarkAllAsRead}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 size={13} className="nt-spinner" />
                ) : (
                  <Check size={13} />
                )}
                Mark All Read
              </button>
            )}
          </div>
        </header>

        {/* Filter Tabs */}
        {notifications.length > 0 && (
          <div className="nt-filters">
            <button
              className={`nt-filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({notifications.length})
            </button>
            <button
              className={`nt-filter-btn ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => setFilter('unread')}
            >
              Unread ({unreadCount})
            </button>
          </div>
        )}

        {/* List */}
        {filteredNotifs.length === 0 ? (
          <div className="nt-empty-state glass-panel">
            <Inbox size={48} className="nt-empty-icon" />
            <h2>No Notifications</h2>
            <p>
              {filter === 'unread'
                ? "You've read all your notifications! Great job."
                : 'Any status updates or alerts about your bookings will appear here.'}
            </p>
            {filter === 'unread' && notifications.length > 0 && (
              <button className="ap-outline-btn nt-state-btn" onClick={() => setFilter('all')}>
                Show All Notifications
              </button>
            )}
          </div>
        ) : (
          <div className="nt-list">
            {filteredNotifs.map((n) => (
              <div
                key={n.id}
                className={`glass-panel nt-item ${!n.isRead ? 'nt-unread' : ''}`}
                onClick={() => !n.isRead && handleMarkAsRead(n.id)}
              >
                <div className="nt-item-left">
                  <NotificationIcon type={n.type} isRead={n.isRead} />
                </div>
                
                <div className="nt-item-body">
                  <div className="nt-item-header">
                    <h3 className="nt-item-title">{n.title || 'Notification'}</h3>
                    <span className="nt-item-time">{formatTime(n.createdAt)}</span>
                  </div>
                  <p className="nt-item-message">{n.message || n.body}</p>
                </div>

                <div className="nt-item-actions">
                  {!n.isRead && (
                    <button
                      className="nt-action-btn nt-read-btn"
                      onClick={(e) => { e.stopPropagation(); handleMarkAsRead(n.id); }}
                      title="Mark as Read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    className="nt-action-btn nt-delete-btn"
                    onClick={(e) => handleDelete(n.id, e)}
                    title="Delete Notification"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Scoped Styles ─────────────────────────────────────────────────── */}
      <style>{`
        .nt-wrapper {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 700px;
          margin: 0 auto;
          padding-bottom: 60px;
        }

        /* Header */
        .nt-header {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .nt-back-btn {
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
        .nt-back-btn:hover { color: var(--primary); }

        .nt-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          flex-wrap: wrap;
          margin-top: 10px;
        }
        .nt-eyebrow {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--primary);
        }
        .nt-title {
          font-size: 1.9rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 4px 0 0 0;
        }
        .nt-subtitle {
          font-size: 0.88rem;
          color: var(--text-secondary);
          margin: 4px 0 0 0;
        }
        .nt-read-all-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          font-size: 0.8rem;
          font-weight: 700;
        }

        /* Filter Tabs */
        .nt-filters {
          display: flex;
          gap: 8px;
        }
        .nt-filter-btn {
          padding: 7px 16px;
          border-radius: 50px;
          border: 1px solid var(--glass-border);
          background: rgba(255,255,255,0.03);
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .nt-filter-btn:hover {
          border-color: rgba(108,99,255,0.35);
          color: var(--text-primary);
        }
        .nt-filter-btn.active {
          background: rgba(108,99,255,0.12);
          border-color: rgba(108,99,255,0.45);
          color: var(--primary);
        }

        /* Notifications List */
        .nt-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* Notification Item */
        .nt-item {
          display: flex;
          gap: 16px;
          padding: 16px 20px;
          align-items: flex-start;
          transition: all 0.25s ease;
          position: relative;
          cursor: pointer;
          overflow: hidden;
        }
        .nt-item:hover {
          border-color: rgba(255, 255, 255, 0.18);
          transform: translateY(-2px);
        }
        .nt-item.nt-unread {
          background: rgba(108, 99, 255, 0.05);
          border-color: rgba(108, 99, 255, 0.25);
        }

        .nt-item-left {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
        }

        .nt-icon {
          padding: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .nt-icon.nt-icon-unread {
          background: rgba(108, 99, 255, 0.1);
          border-color: rgba(108, 99, 255, 0.2);
        }
        .nt-icon-blue { color: var(--primary); }
        .nt-icon-red { color: #EF5350; }
        .nt-icon-green { color: #4CAF50; }
        .nt-icon-purple { color: #9C27B0; }

        .nt-item-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .nt-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .nt-item-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .nt-item-time {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .nt-item-message {
          font-size: 0.88rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.45;
        }

        /* Hover Actions */
        .nt-item-actions {
          display: flex;
          gap: 6px;
          align-items: center;
          opacity: 0;
          transition: opacity 0.2s;
          position: absolute;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          background: var(--glass-bg);
          padding-left: 10px;
          border-radius: 4px;
        }
        .nt-item:hover .nt-item-actions {
          opacity: 1;
        }

        .nt-action-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--glass-border);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }
        .nt-action-btn:hover {
          color: var(--text-primary);
        }
        .nt-read-btn:hover {
          background: rgba(76, 175, 80, 0.12);
          border-color: rgba(76, 175, 80, 0.3);
          color: #4CAF50;
        }
        .nt-delete-btn:hover {
          background: rgba(239, 83, 80, 0.12);
          border-color: rgba(239, 83, 80, 0.3);
          color: #EF5350;
        }

        /* Empty state */
        .nt-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          padding: 60px 32px;
          text-align: center;
        }
        .nt-empty-icon { color: var(--text-secondary); opacity: 0.4; }
        .nt-empty-state h2 { font-size: 1.2rem; color: var(--text-primary); margin: 0; }
        .nt-empty-state p { color: var(--text-secondary); font-size: 0.88rem; margin: 0 0 10px 0; line-height: 1.5; }

        /* Skeletons */
        .nt-skel-icon {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: rgba(255,255,255,0.03);
        }
        .nt-skel-line {
          height: 12px;
          border-radius: 4px;
          background: rgba(255,255,255,0.03);
          margin-bottom: 8px;
        }
        .nt-skel-line.back { width: 80px; height: 14px; }
        .nt-skel-line.header-title { width: 240px; height: 32px; margin-top: 10px; }
        .nt-skel-line.title { width: 45%; height: 14px; }
        .nt-skel-line.text { width: 75%; }
        .nt-skel-line.date { width: 20%; height: 10px; margin-bottom: 0; }
        .nt-skeleton { pointer-events: none; }

        /* Error state */
        .nt-state-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 60px 32px;
          text-align: center;
          max-width: 460px;
          margin: 60px auto;
        }
        .nt-state-center h2 { font-size: 1.3rem; color: var(--text-primary); margin: 0; }
        .nt-state-center p  { color: var(--text-secondary); font-size: 0.88rem; margin: 0; }
        .nt-icon-warn { color: #FFC107; }
        .nt-state-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          border-radius: 50px;
          font-size: 0.9rem;
          margin-top: 8px;
        }

        /* Toast */
        .nt-toast {
          position: fixed; top: 20px; right: 20px;
          display: flex; align-items: center; gap: 10px;
          padding: 12px 18px; border-radius: 8px;
          font-size: 0.85rem; font-weight: 600;
          z-index: 1100; box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          animation: nt-slide-in 0.3s ease;
        }
        @keyframes nt-slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nt-toast.success {
          background: rgba(76,175,80,0.1); border: 1px solid rgba(76,175,80,0.35);
          color: #4CAF50; backdrop-filter: blur(8px);
        }
        .nt-toast.error {
          background: rgba(239,83,80,0.1); border: 1px solid rgba(239,83,80,0.35);
          color: #EF5350; backdrop-filter: blur(8px);
        }
        .nt-spinner { animation: nt-spin 1s linear infinite; }
        @keyframes nt-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default Notifications;
