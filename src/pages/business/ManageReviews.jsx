import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  getDoc,
  setDoc,
  doc,
  updateDoc,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import useAuth from '../../hooks/useAuth';
import {
  Star,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  RefreshCw,
  MessageSquare,
  CheckCircle2,
  Send,
  User,
  CalendarDays,
  Inbox,
  BarChart3,
} from 'lucide-react';

// ─── Star Rating Display ──────────────────────────────────────────────────────
const StarDisplay = ({ rating = 0, size = 14 }) => {
  const stars = [1, 2, 3, 4, 5];
  return (
    <span className="rv-stars-row">
      {stars.map((s) => (
        <Star
          key={s}
          size={size}
          fill={s <= rating ? '#FFBD59' : 'none'}
          stroke={s <= rating ? 'none' : '#FFBD59'}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = ({ style = {} }) => (
  <div className="rv-skeleton" style={style} />
);

// ─── Review Card ──────────────────────────────────────────────────────────────
const ReviewCard = ({ review, onReply }) => {
  const [replyText, setReplyText]   = useState(review.reply || '');
  const [editing, setEditing]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [replyError, setReplyError] = useState('');
  const hasReply = !!review.reply;

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleSaveReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed) { setReplyError('Reply cannot be empty.'); return; }
    setSaving(true);
    setReplyError('');
    try {
      await onReply(review.id, trimmed);
      setEditing(false);
    } catch (err) {
      setReplyError(err.message || 'Failed to save reply.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-panel rv-review-card">
      {/* Header: customer + rating + date */}
      <div className="rv-card-header">
        <div className="rv-customer-info">
          <div className="rv-avatar">
            {(review.customerName || 'A')[0].toUpperCase()}
          </div>
          <div>
            <p className="rv-customer-name">{review.customerName || 'Anonymous'}</p>
            <span className="rv-review-date">
              <CalendarDays size={11} />
              {formatDate(review.createdAt)}
            </span>
          </div>
        </div>
        <div className="rv-rating-wrap">
          <StarDisplay rating={review.rating} size={15} />
          <span className="rv-rating-num">{review.rating}/5</span>
        </div>
      </div>

      {/* Review text */}
      {review.text && (
        <p className="rv-review-text">"{review.text}"</p>
      )}

      {/* Service chip */}
      {review.serviceName && (
        <span className="rv-service-chip">
          Service: {review.serviceName}
        </span>
      )}

      {/* Reply section */}
      <div className="rv-reply-section">
        {hasReply && !editing ? (
          <div className="rv-existing-reply">
            <div className="rv-reply-label">
              <MessageSquare size={12} />
              <span>Your reply</span>
              {review.repliedAt && (
                <span className="rv-reply-date">{formatDate(review.repliedAt)}</span>
              )}
            </div>
            <p className="rv-reply-text">{review.reply}</p>
            <button
              className="rv-edit-reply-btn"
              onClick={() => { setReplyText(review.reply); setEditing(true); }}
            >
              Edit Reply
            </button>
          </div>
        ) : editing || !hasReply ? (
          <div className="rv-reply-compose">
            <textarea
              className="rv-reply-textarea"
              placeholder="Write a professional reply to this review…"
              value={replyText}
              onChange={(e) => { setReplyText(e.target.value); setReplyError(''); }}
              rows={3}
              disabled={saving}
            />
            {replyError && (
              <p className="rv-reply-error">
                <AlertTriangle size={12} /> {replyError}
              </p>
            )}
            <div className="rv-reply-actions">
              {editing && (
                <button
                  className="rv-cancel-btn"
                  onClick={() => { setEditing(false); setReplyText(review.reply || ''); setReplyError(''); }}
                  disabled={saving}
                >
                  Cancel
                </button>
              )}
              <button
                className="btn-primary rv-send-btn"
                onClick={handleSaveReply}
                disabled={saving || !replyText.trim()}
              >
                {saving
                  ? <><Loader2 size={13} className="rv-spinner" /> Saving…</>
                  : <><Send size={13} /> {hasReply ? 'Update Reply' : 'Post Reply'}</>}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ─── ManageReviews ────────────────────────────────────────────────────────────
const ManageReviews = () => {
  const navigate    = useNavigate();
  const { currentUser } = useAuth();

  const [businessId, setBusinessId] = useState(null);
  const [bizName, setBizName]       = useState('');
  const [reviews, setReviews]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [filter, setFilter]         = useState('all'); // 'all' | 'replied' | 'unreplied'
  const [toast, setToast]           = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Step 1: resolve businessId
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'businesses'),
      where('ownerId', '==', currentUser.uid),
      limit(1)
    );
    getDocs(q)
      .then((snap) => {
        if (snap.empty) { setError('No business found for your account.'); setLoading(false); return; }
        const bDoc = snap.docs[0];
        setBusinessId(bDoc.id);
        setBizName(bDoc.data()?.name || 'Your Business');
      })
      .catch((err) => {
        console.error('ManageReviews: resolve business error', err);
        setError('Failed to load business details.');
        setLoading(false);
      });
  }, [currentUser]);

  // Step 2: real-time listener for reviews
  useEffect(() => {
    if (!businessId) return;
    const q = query(
      collection(db, 'reviews'),
      where('businessId', '==', businessId)
    );
    const unsub = onSnapshot(q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setReviews(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('ManageReviews: listener error', err);
        setError('Failed to load reviews.');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [businessId]);

  // Handle reply save
  const handleReply = useCallback(async (reviewId, replyText) => {
    const reviewRef = doc(db, 'reviews', reviewId);
    const rSnap = await getDoc(reviewRef);

    if (rSnap.exists()) {
      const rData = rSnap.data();
      const customerId = rData.customerId;

      await updateDoc(reviewRef, {
        reply:     replyText,
        repliedAt: serverTimestamp(),
      });

      if (customerId) {
        const notifRef = doc(collection(db, 'notifications'));
        await setDoc(notifRef, {
          id: notifRef.id,
          userId: customerId,
          title: 'Review Response Received',
          message: `${bizName || 'The business'} has replied to your review.`,
          body: `${bizName || 'The business'} has replied to your review.`,
          type: 'review_reply',
          isRead: false,
          createdAt: new Date(),
          referenceId: reviewId,
        });
      }
    } else {
      await updateDoc(reviewRef, {
        reply:     replyText,
        repliedAt: serverTimestamp(),
      });
    }

    showToast('Reply posted successfully!');
  }, [bizName]);

  // Stats
  const avgRating    = reviews.length
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : '—';
  const repliedCount   = reviews.filter((r) => !!r.reply).length;
  const unrepliedCount = reviews.length - repliedCount;

  // Filter
  const filteredReviews = filter === 'replied'
    ? reviews.filter((r) => !!r.reply)
    : filter === 'unreplied'
    ? reviews.filter((r) => !r.reply)
    : reviews;

  // Rating distribution
  const ratingDist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => Math.floor(r.rating) === star).length,
  }));

  // ── Loading
  if (loading) {
    return (
      <div className="rv-wrapper animate-fade-in">
        <div className="rv-header">
          <Skeleton style={{ width: 80, height: 14 }} />
          <Skeleton style={{ width: 240, height: 34, marginTop: 10 }} />
        </div>
        <div className="rv-stats-row">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: 80, borderRadius: 12 }} />
          ))}
        </div>
        <div className="rv-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-panel rv-review-card">
              <Skeleton style={{ height: 18, width: '50%', marginBottom: 10 }} />
              <Skeleton style={{ height: 14, width: '80%', marginBottom: 8 }} />
              <Skeleton style={{ height: 40 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error
  if (error) {
    return (
      <div className="rv-state-center glass-panel animate-fade-in">
        <AlertTriangle size={44} className="rv-icon-warn" />
        <h2>Could Not Load Reviews</h2>
        <p>{error}</p>
        <button className="btn-primary rv-state-btn" onClick={() => window.location.reload()}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`rv-toast ${toast.type} animate-fade-in`}>
          {toast.type === 'success'
            ? <CheckCircle2 size={15} />
            : <AlertTriangle size={15} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="rv-wrapper animate-fade-in">
        {/* Header */}
        <header className="rv-header">
          <button className="rv-back-btn" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={15} /> Dashboard
          </button>
          <span className="rv-eyebrow">
            <Star size={13} /> Customer Feedback
          </span>
          <h1 className="rv-title">Reviews &amp; Ratings</h1>
          <p className="rv-subtitle">
            {reviews.length} review{reviews.length !== 1 ? 's' : ''} from customers
          </p>
        </header>

        {/* Stats strip */}
        <div className="rv-stats-row">
          <div className="glass-panel rv-stat-card">
            <span className="rv-stat-label">Average Rating</span>
            <span className="rv-stat-value rv-stat-gold">{avgRating}</span>
            <StarDisplay rating={parseFloat(avgRating) || 0} size={13} />
          </div>
          <div className="glass-panel rv-stat-card">
            <span className="rv-stat-label">Total Reviews</span>
            <span className="rv-stat-value">{reviews.length}</span>
            <span className="rv-stat-sub">{repliedCount} replied</span>
          </div>
          <div className="glass-panel rv-stat-card rv-stat-warn">
            <span className="rv-stat-label">Awaiting Reply</span>
            <span className="rv-stat-value rv-stat-orange">{unrepliedCount}</span>
            <span className="rv-stat-sub">need response</span>
          </div>
        </div>

        {reviews.length > 0 && (
          <div className="rv-body-grid">
            {/* Left: reviews list */}
            <div className="rv-list-col">
              {/* Filter tabs */}
              <div className="rv-filters">
                {[
                  { key: 'all',       label: `All (${reviews.length})` },
                  { key: 'unreplied', label: `Unreplied (${unrepliedCount})` },
                  { key: 'replied',   label: `Replied (${repliedCount})` },
                ].map((f) => (
                  <button
                    key={f.key}
                    className={`rv-filter-btn ${filter === f.key ? 'active' : ''}`}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* List */}
              {filteredReviews.length === 0 ? (
                <div className="rv-empty-state glass-panel">
                  <Inbox size={40} className="rv-empty-icon" />
                  <p>No reviews match this filter.</p>
                </div>
              ) : (
                <div className="rv-list">
                  {filteredReviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      onReply={handleReply}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right: rating breakdown */}
            <div className="rv-sidebar-col">
              <div className="glass-panel rv-breakdown-card">
                <div className="rv-breakdown-header">
                  <BarChart3 size={15} />
                  <h3>Rating Breakdown</h3>
                </div>
                <div className="rv-breakdown-list">
                  {ratingDist.map(({ star, count }) => {
                    const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
                    return (
                      <div key={star} className="rv-breakdown-row">
                        <span className="rv-breakdown-star">
                          {star} <Star size={11} fill="#FFBD59" stroke="none" />
                        </span>
                        <div className="rv-breakdown-bar-bg">
                          <div
                            className="rv-breakdown-bar-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="rv-breakdown-count">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tips card */}
              <div className="glass-panel rv-tips-card">
                <div className="rv-breakdown-header">
                  <MessageSquare size={15} />
                  <h3>Response Tips</h3>
                </div>
                <ul className="rv-tips-list">
                  <li>Reply within 24 hours to show customers you care.</li>
                  <li>Thank positive reviewers by name.</li>
                  <li>Address negative feedback professionally and offer solutions.</li>
                  <li>Keep replies concise and genuine.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Empty state when no reviews at all */}
        {reviews.length === 0 && (
          <div className="rv-empty-state glass-panel animate-fade-in">
            <Star size={48} className="rv-empty-icon" />
            <h2>No Reviews Yet</h2>
            <p>Once customers complete their bookings and leave reviews, they'll appear here.</p>
          </div>
        )}
      </div>

      {/* ─── Scoped Styles ─────────────────────────────────────────────────── */}
      <style>{`
        .rv-wrapper {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 1100px;
          margin: 0 auto;
          padding-bottom: 60px;
        }

        /* Header */
        .rv-header { display: flex; flex-direction: column; gap: 5px; }
        .rv-back-btn {
          display: flex; align-items: center; gap: 5px;
          background: none; border: none; color: var(--text-secondary);
          font-size: 0.82rem; font-weight: 600; cursor: pointer;
          padding: 0; align-self: flex-start; transition: color 0.2s;
        }
        .rv-back-btn:hover { color: var(--primary); }
        .rv-eyebrow {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.72rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.08em; color: var(--primary);
        }
        .rv-title { font-size: 1.9rem; font-weight: 800; color: var(--text-primary); margin: 0; }
        .rv-subtitle { font-size: 0.88rem; color: var(--text-secondary); margin: 0; }

        /* Stats strip */
        .rv-stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 640px) { .rv-stats-row { grid-template-columns: 1fr; } }
        .rv-stat-card {
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .rv-stat-label {
          font-size: 0.72rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary);
        }
        .rv-stat-value { font-size: 2rem; font-weight: 800; color: var(--text-primary); line-height: 1; }
        .rv-stat-gold { color: #FFBD59; }
        .rv-stat-orange { color: #FF9800; }
        .rv-stat-sub { font-size: 0.74rem; color: var(--text-secondary); }
        .rv-stars-row { display: flex; align-items: center; gap: 2px; }

        /* Body grid */
        .rv-body-grid {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 900px) { .rv-body-grid { grid-template-columns: 1fr; } }
        .rv-list-col { display: flex; flex-direction: column; gap: 16px; }
        .rv-sidebar-col { display: flex; flex-direction: column; gap: 16px; }

        /* Filters */
        .rv-filters { display: flex; gap: 8px; flex-wrap: wrap; }
        .rv-filter-btn {
          padding: 7px 16px; border-radius: 50px;
          border: 1px solid var(--glass-border);
          background: rgba(255,255,255,0.03);
          color: var(--text-secondary);
          font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .rv-filter-btn:hover { border-color: rgba(108,99,255,0.35); color: var(--text-primary); }
        .rv-filter-btn.active {
          background: rgba(108,99,255,0.12);
          border-color: rgba(108,99,255,0.45);
          color: var(--primary);
        }

        /* Review list */
        .rv-list { display: flex; flex-direction: column; gap: 16px; }

        /* Review card */
        .rv-review-card { padding: 20px 22px; display: flex; flex-direction: column; gap: 14px; }

        .rv-card-header {
          display: flex; justify-content: space-between;
          align-items: flex-start; gap: 12px; flex-wrap: wrap;
        }
        .rv-customer-info { display: flex; align-items: center; gap: 12px; }
        .rv-avatar {
          width: 38px; height: 38px; border-radius: 50%;
          background: rgba(108,99,255,0.12);
          border: 2px solid rgba(108,99,255,0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 1rem; font-weight: 800; color: var(--primary);
          flex-shrink: 0;
        }
        .rv-customer-name { font-size: 0.92rem; font-weight: 700; color: var(--text-primary); margin: 0 0 3px; }
        .rv-review-date {
          display: flex; align-items: center; gap: 4px;
          font-size: 0.72rem; color: var(--text-secondary);
        }
        .rv-rating-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
        .rv-rating-num { font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); }

        .rv-review-text {
          font-size: 0.9rem; color: var(--text-primary);
          line-height: 1.6; margin: 0;
          font-style: italic;
          padding: 10px 14px;
          background: rgba(255,255,255,0.02);
          border-left: 3px solid rgba(108,99,255,0.4);
          border-radius: 0 6px 6px 0;
        }
        .rv-service-chip {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 0.72rem; font-weight: 700;
          padding: 3px 10px; border-radius: 50px;
          background: rgba(0,230,180,0.08);
          border: 1px solid rgba(0,230,180,0.25);
          color: var(--teal);
          align-self: flex-start;
        }

        /* Reply section */
        .rv-reply-section { display: flex; flex-direction: column; gap: 10px; }
        .rv-existing-reply {
          padding: 12px 14px;
          background: rgba(108,99,255,0.05);
          border: 1px solid rgba(108,99,255,0.2);
          border-radius: 8px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .rv-reply-label {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.72rem; font-weight: 700;
          color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em;
        }
        .rv-reply-date { margin-left: auto; color: var(--text-secondary); font-weight: 400; text-transform: none; }
        .rv-reply-text { font-size: 0.88rem; color: var(--text-primary); margin: 0; line-height: 1.5; }
        .rv-edit-reply-btn {
          align-self: flex-start; background: none; border: none;
          color: var(--primary); font-size: 0.75rem; font-weight: 700;
          cursor: pointer; padding: 0; transition: opacity 0.2s;
          text-decoration: underline; text-underline-offset: 2px;
        }
        .rv-edit-reply-btn:hover { opacity: 0.7; }

        .rv-reply-compose { display: flex; flex-direction: column; gap: 8px; }
        .rv-reply-textarea {
          width: 100%; padding: 10px 12px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--glass-border);
          border-radius: 8px; color: var(--text-primary);
          font-size: 0.88rem; resize: vertical; outline: none;
          transition: border-color 0.2s; line-height: 1.5;
          font-family: inherit;
        }
        .rv-reply-textarea:focus { border-color: rgba(108,99,255,0.45); }
        .rv-reply-error {
          display: flex; align-items: center; gap: 5px;
          font-size: 0.78rem; color: #EF5350;
        }
        .rv-reply-actions { display: flex; gap: 8px; justify-content: flex-end; }
        .rv-cancel-btn {
          padding: 7px 16px; border-radius: 50px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--glass-border);
          color: var(--text-secondary);
          font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .rv-cancel-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: var(--text-primary); }
        .rv-send-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 16px; border-radius: 50px;
          font-size: 0.8rem; font-weight: 700;
        }
        .rv-send-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        /* Rating breakdown */
        .rv-breakdown-card, .rv-tips-card { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }
        .rv-breakdown-header {
          display: flex; align-items: center; gap: 8px;
          color: var(--primary);
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 10px;
        }
        .rv-breakdown-header h3 {
          font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin: 0;
        }
        .rv-breakdown-list { display: flex; flex-direction: column; gap: 10px; }
        .rv-breakdown-row { display: flex; align-items: center; gap: 10px; }
        .rv-breakdown-star {
          display: flex; align-items: center; gap: 3px;
          font-size: 0.8rem; font-weight: 700; color: var(--text-secondary);
          width: 32px; flex-shrink: 0;
        }
        .rv-breakdown-bar-bg {
          flex: 1; height: 6px; border-radius: 50px;
          background: rgba(255,255,255,0.06);
          overflow: hidden;
        }
        .rv-breakdown-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #FFBD59, #FF9800);
          border-radius: 50px;
          transition: width 0.6s ease;
        }
        .rv-breakdown-count {
          font-size: 0.78rem; font-weight: 700;
          color: var(--text-secondary); width: 20px; text-align: right;
        }

        /* Tips */
        .rv-tips-list {
          padding: 0 0 0 16px; margin: 0;
          display: flex; flex-direction: column; gap: 8px;
        }
        .rv-tips-list li {
          font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;
        }

        /* Empty */
        .rv-empty-state {
          display: flex; flex-direction: column;
          align-items: center; gap: 14px;
          padding: 60px 32px; text-align: center;
        }
        .rv-empty-icon { color: var(--text-secondary); opacity: 0.4; }
        .rv-empty-state h2 { font-size: 1.2rem; color: var(--text-primary); margin: 0; }
        .rv-empty-state p { color: var(--text-secondary); font-size: 0.88rem; margin: 0; line-height: 1.5; }

        /* Error state */
        .rv-state-center {
          display: flex; flex-direction: column; align-items: center;
          gap: 16px; padding: 60px 32px; text-align: center;
          max-width: 460px; margin: 60px auto;
        }
        .rv-state-center h2 { font-size: 1.3rem; color: var(--text-primary); margin: 0; }
        .rv-state-center p  { color: var(--text-secondary); font-size: 0.88rem; margin: 0; }
        .rv-icon-warn { color: #FFC107; }
        .rv-state-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 24px; border-radius: 50px; font-size: 0.9rem; margin-top: 8px;
        }

        /* Toast */
        .rv-toast {
          position: fixed; top: 20px; right: 20px;
          display: flex; align-items: center; gap: 10px;
          padding: 12px 18px; border-radius: 8px;
          font-size: 0.85rem; font-weight: 600;
          z-index: 1100; box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          animation: rv-slide-in 0.3s ease;
        }
        @keyframes rv-slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rv-toast.success {
          background: rgba(76,175,80,0.1); border: 1px solid rgba(76,175,80,0.35);
          color: #4CAF50; backdrop-filter: blur(8px);
        }
        .rv-toast.error {
          background: rgba(239,83,80,0.1); border: 1px solid rgba(239,83,80,0.35);
          color: #EF5350; backdrop-filter: blur(8px);
        }

        /* Skeleton */
        .rv-skeleton {
          background: linear-gradient(90deg,
            rgba(255,255,255,0.04) 25%,
            rgba(255,255,255,0.09) 50%,
            rgba(255,255,255,0.04) 75%
          );
          background-size: 200% 100%;
          animation: rv-shimmer 1.4s ease-in-out infinite;
          border-radius: 4px; width: 100%; height: 14px;
        }
        @keyframes rv-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .rv-spinner { animation: rv-spin 1s linear infinite; }
        @keyframes rv-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default ManageReviews;
