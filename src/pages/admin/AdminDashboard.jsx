import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import useAuth from '../../hooks/useAuth';
import {
  Users,
  Building2,
  CalendarDays,
  Star,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Inbox,
  FileText,
} from 'lucide-react';


// ─── Stat Card Component ──────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, accent }) => (
  <div className="glass-panel ad-stat-card" style={{ '--accent': accent }}>
    <div className="ad-stat-icon-wrap">
      <Icon size={20} className="ad-stat-icon" />
    </div>
    <div className="ad-stat-info">
      <span className="ad-stat-label">{label}</span>
      <span className="ad-stat-value">{value}</span>
      {sub && <span className="ad-stat-sub">{sub}</span>}
    </div>
  </div>
);

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const SkeletonTable = () => (
  <div className="ad-skeleton-table">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="ad-skeleton-row">
        <div className="ad-skeleton-cell" style={{ width: '25%' }} />
        <div className="ad-skeleton-cell" style={{ width: '20%' }} />
        <div className="ad-skeleton-cell" style={{ width: '15%' }} />
        <div className="ad-skeleton-cell" style={{ width: '20%' }} />
        <div className="ad-skeleton-cell" style={{ width: '20%' }} />
      </div>
    ))}
  </div>
);

// ─── AdminDashboard ──────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Core Data State
  const [users, setUsers]             = useState([]);
  const [businesses, setBusinesses]   = useState([]);
  const [bookings, setBookings]       = useState([]);
  const [reviews, setReviews]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  // Tab State
  const [activeTab, setActiveTab]     = useState('businesses'); // 'businesses' | 'users' | 'bookings'

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [toast, setToast]             = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Step 1: Real-time listeners for all core collections
  useEffect(() => {
    setLoading(true);
    setError(null);

    // 1. Users Listener
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error('AdminDashboard: users listener error', err);
        setError('Failed to load users data.');
      }
    );

    // 2. Businesses Listener
    const unsubBiz = onSnapshot(
      collection(db, 'businesses'),
      (snap) => {
        setBusinesses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error('AdminDashboard: businesses listener error', err);
        setError('Failed to load businesses data.');
      }
    );

    // 3. Bookings Listener
    const unsubBookings = onSnapshot(
      collection(db, 'bookings'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setBookings(list);
      },
      (err) => {
        console.error('AdminDashboard: bookings listener error', err);
        setError('Failed to load bookings data.');
      }
    );

    // 4. Reviews Listener
    const unsubReviews = onSnapshot(
      collection(db, 'reviews'),
      (snap) => {
        setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('AdminDashboard: reviews listener error', err);
        setError('Failed to load reviews data.');
        setLoading(false);
      }
    );

    return () => {
      unsubUsers();
      unsubBiz();
      unsubBookings();
      unsubReviews();
    };
  }, []);

  // ── Derived Metrics Calculations
  const metrics = useMemo(() => {
    const totalUsers = users.length;
    const totalCustomers = users.filter((u) => u.role === 'customer').length;
    const totalBusinesses = businesses.length;
    const verifiedBusinesses = businesses.filter((b) => b.isVerified === true).length;

    const totalBookings = bookings.length;
    const activeBookings = bookings.filter((b) => ['pending', 'active'].includes(b.status)).length;
    const completedBookings = bookings.filter((b) => b.status === 'served').length;
    const cancelledBookings = bookings.filter((b) => b.status === 'cancelled').length;

    const totalReviews = reviews.length;
    
    // Average platform rating: average of all business ratings
    const validRatings = businesses.filter((b) => b.rating && parseFloat(b.rating) > 0);
    const avgPlatformRating = validRatings.length
      ? (validRatings.reduce((sum, b) => sum + parseFloat(b.rating), 0) / validRatings.length).toFixed(1)
      : '—';

    return {
      totalUsers,
      totalCustomers,
      totalBusinesses,
      verifiedBusinesses,
      totalBookings,
      activeBookings,
      completedBookings,
      cancelledBookings,
      totalReviews,
      avgPlatformRating,
    };
  }, [users, businesses, bookings, reviews]);

  // Categories list derived from businesses
  const categoriesList = useMemo(() => {
    const cats = new Set(businesses.map((b) => b.category).filter(Boolean));
    return ['all', ...Array.from(cats)];
  }, [businesses]);

  // ── Admin Action Handlers
  const handleToggleVerify = async (businessId, currentVal) => {
    setActionLoadingId(businessId + '-verify');
    try {
      const bizRef = doc(db, 'businesses', businessId);
      await updateDoc(bizRef, { isVerified: !currentVal });
      showToast(`Business ${!currentVal ? 'verified' : 'unverified'} successfully.`);
    } catch (err) {
      console.error('Failed to toggle verification', err);
      showToast('Action failed. Try again.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleOpen = async (businessId, currentVal) => {
    setActionLoadingId(businessId + '-open');
    try {
      const bizRef = doc(db, 'businesses', businessId);
      await updateDoc(bizRef, { isOpen: !currentVal });
      showToast(`Business ${!currentVal ? 'opened' : 'closed'} successfully.`);
    } catch (err) {
      console.error('Failed to toggle open status', err);
      showToast('Action failed. Try again.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleChangePlan = async (businessId, newPlan) => {
    setActionLoadingId(businessId + '-plan');
    try {
      const bizRef = doc(db, 'businesses', businessId);
      await updateDoc(bizRef, { plan: newPlan });
      showToast(`Plan updated to ${newPlan.toUpperCase()}.`);
    } catch (err) {
      console.error('Failed to change plan', err);
      showToast('Action failed. Try again.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Filters & Search Lists
  const filteredBusinesses = useMemo(() => {
    return businesses.filter((b) => {
      const matchesSearch = (b.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (b.ownerId || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat    = categoryFilter === 'all' || b.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [businesses, searchQuery, categoryFilter]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      return (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
             (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
             (u.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
             (u.role || '').toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [users, searchQuery]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      return (b.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
             (b.businessName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
             (b.status || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
             (b.tokenNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [bookings, searchQuery]);

  const formatDateString = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Loading indicator
  if (loading) {
    return (
      <div className="ad-wrapper animate-fade-in">
        <header className="ad-header">
          <div className="ad-skel-line" style={{ width: '240px', height: '32px' }} />
          <div className="ad-skel-line" style={{ width: '150px', height: '14px', marginTop: '10px' }} />
        </header>
        <div className="ad-stats-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-panel ad-stat-card nt-skeleton" style={{ height: '90px' }} />
          ))}
        </div>
        <SkeletonTable />
      </div>
    );
  }

  // Error boundary indicator
  if (error) {
    return (
      <div className="ad-state-center glass-panel animate-fade-in">
        <AlertTriangle size={44} className="ad-icon-warn" />
        <h2>Platform Operations Mismatch</h2>
        <p>{error}</p>
        <button className="btn-primary ad-state-btn" onClick={() => window.location.reload()}>
          <RefreshCw size={14} /> Retry Diagnostics
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Toast Alert Banner */}
      {toast && (
        <div className={`ad-toast ${toast.type} animate-fade-in`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="ad-wrapper animate-fade-in">
        {/* Header Title Bar */}
        <header className="ad-header">
          <div>
            <span className="ad-eyebrow">
              <Sparkles size={13} /> QueueLess Operations
            </span>
            <h1 className="ad-title">Super Admin Dashboard</h1>
            <p className="ad-subtitle">Real-time platform stats, venue validation, and role directory monitoring.</p>
          </div>
          <button
            className="ad-reports-link"
            onClick={() => navigate('/admin/reports')}
            title="Open Reports Export"
          >
            <FileText size={15} /> Reports Export
          </button>
        </header>

        {/* ── Summary Stats Grid (10 Summary Metrics) ── */}
        <section className="ad-stats-grid" aria-label="Platform summary counters">
          <StatCard icon={Users} label="Total Users" value={metrics.totalUsers} sub={`${metrics.totalCustomers} customers`} accent="var(--primary)" />
          <StatCard icon={Building2} label="Businesses" value={metrics.totalBusinesses} sub={`${metrics.verifiedBusinesses} verified`} accent="#00E6B4" />
          <StatCard icon={CalendarDays} label="Total Bookings" value={metrics.totalBookings} sub={`${metrics.activeBookings} live queue`} accent="#74B9FF" />
          <StatCard icon={CheckCircle2} label="Completed" value={metrics.completedBookings} sub="served booking files" accent="#4CAF50" />
          <StatCard icon={XCircle} label="Cancelled" value={metrics.cancelledBookings} sub="customer / venue aborts" accent="#EF5350" />
          <StatCard icon={Star} label="Avg Rating" value={metrics.avgPlatformRating} sub={`${metrics.totalReviews} total reviews`} accent="#FFC107" />
        </section>

        {/* ── Tab Layout Sections ── */}
        <div className="ad-tab-container">
          <div className="ad-tabs" role="tablist">
            {[
              { key: 'businesses', label: `Venues (${businesses.length})` },
              { key: 'users', label: `Users (${users.length})` },
              { key: 'bookings', label: `Live Bookings (${bookings.length})` }
            ].map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={activeTab === t.key}
                className={`ad-tab-btn ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => { setActiveTab(t.key); setSearchQuery(''); }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search and Filters Bar */}
          <div className="ad-search-bar">
            <div className="ad-search-input-wrap">
              <Search size={16} className="ad-search-icon" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {activeTab === 'businesses' && (
              <div className="ad-filter-select-wrap">
                <Filter size={14} className="ad-filter-icon" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {categoriesList.filter(c => c !== 'all').map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ── TAB CONTENT: BUSINESSES ── */}
        {activeTab === 'businesses' && (
          <div className="glass-panel ad-table-card">
            {filteredBusinesses.length === 0 ? (
              <div className="ad-empty">
                <Inbox size={32} />
                <p>No businesses matches the current filters.</p>
              </div>
            ) : (
              <div className="ad-table-scroll">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>Business Name</th>
                      <th>Owner ID</th>
                      <th>Category</th>
                      <th>Verification</th>
                      <th>Operating Plan</th>
                      <th>Live Status</th>
                      <th>Queue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBusinesses.map((b) => {
                      const isVerifyLoading = actionLoadingId === b.id + '-verify';
                      const isOpenLoading   = actionLoadingId === b.id + '-open';
                      const isPlanLoading   = actionLoadingId === b.id + '-plan';

                      return (
                        <tr key={b.id}>
                          <td>
                            <div className="ad-biz-cell">
                              <span className="ad-biz-name">{b.name || 'Unnamed Venue'}</span>
                              <span className="ad-biz-id">ID: {b.id}</span>
                            </div>
                          </td>
                          <td className="ad-mono">{b.ownerId || '—'}</td>
                          <td>
                            <span className="ad-tag category">{b.category || '—'}</span>
                          </td>
                          <td>
                            <button
                              className={`ad-btn-toggle ${b.isVerified ? 'verified' : ''}`}
                              onClick={() => handleToggleVerify(b.id, b.isVerified)}
                              disabled={isVerifyLoading}
                            >
                              {isVerifyLoading ? (
                                <Loader2 size={13} className="ad-spinner" />
                              ) : b.isVerified ? (
                                <><ShieldCheck size={13} /> Verified</>
                              ) : (
                                <><ShieldAlert size={13} /> Unverified</>
                              )}
                            </button>
                          </td>
                          <td>
                            <select
                              className="ad-table-select"
                              value={b.plan || 'free'}
                              onChange={(e) => handleChangePlan(b.id, e.target.value)}
                              disabled={isPlanLoading}
                            >
                              <option value="free">Free</option>
                              <option value="pro">Pro</option>
                              <option value="enterprise">Enterprise</option>
                            </select>
                          </td>
                          <td>
                            <button
                              className={`ad-btn-toggle open-closed ${b.isOpen ? 'open' : 'closed'}`}
                              onClick={() => handleToggleOpen(b.id, b.isOpen)}
                              disabled={isOpenLoading}
                            >
                              {isOpenLoading ? (
                                <Loader2 size={13} className="ad-spinner" />
                              ) : b.isOpen ? (
                                'Open'
                              ) : (
                                'Closed'
                              )}
                            </button>
                          </td>
                          <td className="ad-bold">{b.currentQueue ?? 0} waiting</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONTENT: USERS ── */}
        {activeTab === 'users' && (
          <div className="glass-panel ad-table-card">
            {filteredUsers.length === 0 ? (
              <div className="ad-empty">
                <Inbox size={32} />
                <p>No user records matched your query.</p>
              </div>
            ) : (
              <div className="ad-table-scroll">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>Name / Details</th>
                      <th>Email Address</th>
                      <th>Contact Phone</th>
                      <th>Platform Role</th>
                      <th>Member Since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="ad-user-cell">
                            <span className="ad-user-avatar">
                              {(u.name || 'U')[0].toUpperCase()}
                            </span>
                            <div>
                              <span className="ad-user-name">{u.name || 'Anonymous User'}</span>
                              <span className="ad-user-id">UID: {u.id}</span>
                            </div>
                          </div>
                        </td>
                        <td>{u.email || '—'}</td>
                        <td className="ad-mono">{u.phone || '—'}</td>
                        <td>
                          <span className={`ad-tag role-${u.role || 'customer'}`}>
                            {u.role || 'customer'}
                          </span>
                        </td>
                        <td>{formatDateString(u.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONTENT: BOOKINGS ── */}
        {activeTab === 'bookings' && (
          <div className="glass-panel ad-table-card">
            {filteredBookings.length === 0 ? (
              <div className="ad-empty">
                <Inbox size={32} />
                <p>No booking items match this search.</p>
              </div>
            ) : (
              <div className="ad-table-scroll">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Customer Name</th>
                      <th>Target Venue</th>
                      <th>Service Details</th>
                      <th>Status Badge</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((bk) => {
                      let statusClass = 'pending';
                      if (bk.status === 'confirmed') statusClass = 'confirmed';
                      if (bk.status === 'active')    statusClass = 'active';
                      if (bk.status === 'served')    statusClass = 'served';
                      if (bk.status === 'cancelled') statusClass = 'cancelled';

                      return (
                        <tr key={bk.id}>
                          <td className="ad-bold ad-mono">{bk.tokenNumber || '—'}</td>
                          <td>{bk.customerName || 'Anonymous'}</td>
                          <td className="ad-bold">{bk.businessName || '—'}</td>
                          <td>{bk.serviceName || '—'}</td>
                          <td>
                            <span className={`ad-tag booking-${statusClass}`}>
                              {bk.status}
                            </span>
                          </td>
                          <td className="ad-bold ad-price">₹{bk.price ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Scoped Styling Block ── */}
      <style>{`
        .ad-wrapper {
          display: flex;
          flex-direction: column;
          gap: 28px;
          max-width: 1200px;
          margin: 0 auto;
          padding-bottom: 60px;
        }

        /* Header block */
        .ad-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }
        .ad-eyebrow {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--primary);
        }
        .ad-title { font-size: 2rem; font-weight: 800; color: var(--text-primary); margin: 0; }
        .ad-subtitle { font-size: 0.88rem; color: var(--text-secondary); margin: 0; }
        .ad-reports-link {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 20px; border-radius: 50px;
          border: 1px solid rgba(108,99,255,0.3);
          background: rgba(108,99,255,0.08);
          color: var(--primary); font-size: 0.84rem; font-weight: 600;
          cursor: pointer; transition: all 0.2s; margin-top: 38px; flex-shrink: 0;
        }
        .ad-reports-link:hover {
          background: rgba(108,99,255,0.16);
          border-color: rgba(108,99,255,0.5);
          transform: translateY(-1px);
        }

        /* Stats Grid */
        .ad-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
        }
        .ad-stat-card {
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          border-left: 3px solid var(--accent, var(--primary));
        }
        .ad-stat-icon-wrap {
          width: 40px; height: 40px; border-radius: 50%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ad-stat-icon { color: var(--accent, var(--primary)); }
        .ad-stat-info { display: flex; flex-direction: column; gap: 2px; }
        .ad-stat-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); }
        .ad-stat-value { font-size: 1.45rem; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
        .ad-stat-sub { font-size: 0.72rem; color: var(--text-secondary); }

        /* Tabs container */
        .ad-tab-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 12px;
        }
        .ad-tabs { display: flex; gap: 8px; }
        .ad-tab-btn {
          padding: 8px 18px; border-radius: 50px;
          border: 1px solid var(--glass-border);
          background: rgba(255,255,255,0.02);
          color: var(--text-secondary);
          font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .ad-tab-btn:hover { border-color: rgba(108,99,255,0.3); color: var(--text-primary); }
        .ad-tab-btn.active {
          background: rgba(108,99,255,0.12);
          border-color: rgba(108,99,255,0.45);
          color: var(--primary);
        }

        /* Search bar */
        .ad-search-bar { display: flex; gap: 12px; align-items: center; }
        .ad-search-input-wrap {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 14px; border-radius: 50px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--glass-border);
          width: 200px; transition: width 0.2s;
        }
        .ad-search-input-wrap:focus-within { width: 260px; border-color: rgba(108,99,255,0.4); }
        .ad-search-input-wrap input {
          background: none; border: none; outline: none;
          color: var(--text-primary); font-size: 0.82rem; width: 100%;
        }
        .ad-search-icon { color: var(--text-secondary); }

        .ad-filter-select-wrap {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 50px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--glass-border);
        }
        .ad-filter-select-wrap select {
          background: none; border: none; outline: none;
          color: var(--text-primary); font-size: 0.82rem; cursor: pointer;
        }
        .ad-filter-select-wrap select option {
          background: #141124; color: var(--text-primary);
        }
        .ad-filter-icon { color: var(--text-secondary); }

        /* Table components */
        .ad-table-card { padding: 8px; overflow: hidden; }
        .ad-table-scroll { overflow-x: auto; width: 100%; }
        .ad-table {
          width: 100%; border-collapse: collapse; text-align: left;
        }
        .ad-table th {
          padding: 14px 16px; font-size: 0.72rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.05em;
          color: var(--text-secondary); border-bottom: 1px solid var(--glass-border);
        }
        .ad-table td {
          padding: 14px 16px; font-size: 0.88rem; color: var(--text-primary);
          border-bottom: 1px solid rgba(255,255,255,0.03);
          vertical-align: middle;
        }
        .ad-table tr:hover td { background: rgba(255,255,255,0.01); }

        /* Cells formatting */
        .ad-biz-cell, .ad-user-cell { display: flex; flex-direction: column; gap: 3px; }
        .ad-biz-name, .ad-user-name { font-weight: 700; color: var(--text-primary); }
        .ad-biz-id, .ad-user-id { font-size: 0.7rem; color: var(--text-secondary); font-family: monospace; }
        .ad-user-cell { flex-direction: row; align-items: center; gap: 12px; }
        .ad-user-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: rgba(108,99,255,0.12);
          border: 1px solid rgba(108,99,255,0.25);
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; color: var(--primary); font-size: 0.9rem; flex-shrink: 0;
        }

        .ad-mono { font-family: monospace; font-size: 0.78rem; color: var(--text-secondary); }
        .ad-bold { font-weight: 700; }
        .ad-price { color: var(--teal); }

        /* Toggle Actions */
        .ad-btn-toggle {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 50px; font-size: 0.76rem; font-weight: 700;
          border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03);
          color: var(--text-secondary); cursor: pointer; transition: all 0.2s;
        }
        .ad-btn-toggle:hover:not(:disabled) { border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.06); }
        .ad-btn-toggle.verified {
          border-color: rgba(0,230,180,0.25); background: rgba(0,230,180,0.08); color: var(--teal);
        }
        .ad-btn-toggle.open-closed.open {
          border-color: rgba(76,175,80,0.25); background: rgba(76,175,80,0.08); color: #4CAF50;
        }
        .ad-btn-toggle.open-closed.closed {
          border-color: rgba(239,83,80,0.25); background: rgba(239,83,80,0.08); color: #EF5350;
        }

        .ad-table-select {
          padding: 4px 8px; border-radius: 4px;
          border: 1px solid var(--glass-border);
          background: rgba(255,255,255,0.04);
          color: var(--text-primary); font-size: 0.8rem; outline: none; cursor: pointer;
        }
        .ad-table-select option { background: #141124; }

        /* Tags */
        .ad-tag {
          display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 4px;
          font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
        }
        .ad-tag.category { background: rgba(108,99,255,0.12); color: var(--primary); border: 1px solid rgba(108,99,255,0.2); }
        .ad-tag.role-admin { background: rgba(255,152,0,0.12); color: #FF9800; border: 1px solid rgba(255,152,0,0.2); }
        .ad-tag.role-business { background: rgba(0,230,180,0.12); color: var(--teal); border: 1px solid rgba(0,230,180,0.2); }
        .ad-tag.role-customer { background: rgba(255,255,255,0.06); color: var(--text-secondary); border: 1px solid rgba(255,255,255,0.08); }

        .ad-tag.booking-pending { background: rgba(255,193,7,0.12); color: #FFC107; }
        .ad-tag.booking-confirmed { background: rgba(108,99,255,0.12); color: var(--primary); }
        .ad-tag.booking-active { background: rgba(0,230,180,0.12); color: var(--teal); }
        .ad-tag.booking-served { background: rgba(76,175,80,0.12); color: #4CAF50; }
        .ad-tag.booking-cancelled { background: rgba(239,83,80,0.12); color: #EF5350; }

        /* Empty state */
        .ad-empty {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          padding: 60px 24px; text-align: center; color: var(--text-secondary);
        }
        .ad-empty p { font-size: 0.88rem; margin: 0; }

        /* Diagnostics Error state */
        .ad-state-center {
          display: flex; flex-direction: column; align-items: center;
          gap: 16px; padding: 60px 32px; text-align: center;
          max-width: 460px; margin: 60px auto;
        }
        .ad-state-center h2 { font-size: 1.3rem; color: var(--text-primary); margin: 0; }
        .ad-state-center p  { color: var(--text-secondary); font-size: 0.88rem; margin: 0; }
        .ad-icon-warn { color: #FFC107; }
        .ad-state-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 24px; border-radius: 50px; font-size: 0.9rem; margin-top: 8px;
        }

        /* Skeletons */
        .ad-skel-line {
          background: rgba(255,255,255,0.03); border-radius: 4px;
        }
        .ad-skeleton-table { display: flex; flex-direction: column; gap: 12px; margin-top: 20px; }
        .ad-skeleton-row {
          display: flex; gap: 16px; padding: 14px 16px; background: rgba(255,255,255,0.01); border-radius: 6px;
        }
        .ad-skeleton-cell { height: 16px; background: rgba(255,255,255,0.03); border-radius: 4px; }

        /* Toast Alert */
        .ad-toast {
          position: fixed; top: 20px; right: 20px;
          display: flex; align-items: center; gap: 10px;
          padding: 12px 18px; border-radius: 8px;
          font-size: 0.85rem; font-weight: 600;
          z-index: 1100; box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          animation: ad-slide-in 0.3s ease;
        }
        @keyframes ad-slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ad-toast.success {
          background: rgba(76,175,80,0.1); border: 1px solid rgba(76,175,80,0.35);
          color: #4CAF50; backdrop-filter: blur(8px);
        }
        .ad-toast.error {
          background: rgba(239,83,80,0.1); border: 1px solid rgba(239,83,80,0.35);
          color: #EF5350; backdrop-filter: blur(8px);
        }
        .ad-spinner { animation: ad-spin 1s linear infinite; }
        @keyframes ad-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default AdminDashboard;
