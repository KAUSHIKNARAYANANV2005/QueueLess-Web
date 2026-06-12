import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  FileText,
  Download,
  Printer,
  CalendarDays,
  Users,
  Building2,
  Star,
  CheckCircle2,
  XCircle,
  Filter,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  ArrowLeft,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  Loader2,
  ChevronDown,
  Inbox,
} from 'lucide-react';

// ─── Helper: Convert array of objects to CSV string ───────────────────────────
const toCSV = (rows, columns) => {
  if (!rows || rows.length === 0) return '';
  const escape = (val) => {
    const s = val == null ? '' : String(val);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escape(c.value(row))).join(','))
    .join('\n');
  return `${header}\n${body}`;
};

// ─── Helper: Trigger download of a CSV string ─────────────────────────────────
const downloadCSV = (csvString, filename) => {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ─── Helper: Format Firestore timestamp ──────────────────────────────────────
const fmtDate = (ts) => {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return ''; }
};

const fmtDateISO = (ts) => {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toISOString().split('T')[0];
  } catch { return ''; }
};

// ─── Stat Summary Card ────────────────────────────────────────────────────────
const SummaryCard = ({ icon: Icon, label, value, sub, accent }) => (
  <div className="rp-card glass-panel" style={{ '--rp-accent': accent }}>
    <div className="rp-card-icon">
      <Icon size={18} />
    </div>
    <div className="rp-card-body">
      <span className="rp-card-label">{label}</span>
      <span className="rp-card-value">{value}</span>
      {sub && <span className="rp-card-sub">{sub}</span>}
    </div>
  </div>
);

// ─── Export Button ────────────────────────────────────────────────────────────
const ExportBtn = ({ onClick, disabled, icon: Icon, label, count, accent }) => (
  <button
    className="rp-export-btn glass-panel"
    style={{ '--rp-accent': accent }}
    onClick={onClick}
    disabled={disabled}
    title={`Download ${label} CSV`}
  >
    <div className="rp-export-icon"><Icon size={20} /></div>
    <div className="rp-export-info">
      <span className="rp-export-label">{label}</span>
      <span className="rp-export-count">{count} rows</span>
    </div>
    <Download size={15} className="rp-export-dl-icon" />
  </button>
);

// ─── Skeleton Row ─────────────────────────────────────────────────────────────
const SkeletonRows = ({ rows = 5, cols = 5 }) => (
  <tbody>
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i}>
        {Array.from({ length: cols }).map((__, j) => (
          <td key={j}><div className="rp-skel-cell" style={{ width: `${60 + (j * 7) % 30}%` }} /></td>
        ))}
      </tr>
    ))}
  </tbody>
);

// ─── ReportsExport ────────────────────────────────────────────────────────────
const ReportsExport = () => {
  const navigate = useNavigate();
  const printRef = useRef(null);

  // Raw data
  const [users,      setUsers]      = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [bookings,   setBookings]   = useState([]);
  const [reviews,    setReviews]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  // Active report tab: 'bookings' | 'businesses' | 'users' | 'reviews'
  const [activeReport, setActiveReport] = useState('bookings');

  // Filters
  const today     = new Date();
  const thirtyAgo = new Date(today); thirtyAgo.setDate(today.getDate() - 30);
  const [dateFrom,      setDateFrom]      = useState(thirtyAgo.toISOString().split('T')[0]);
  const [dateTo,        setDateTo]        = useState(today.toISOString().split('T')[0]);
  const [categoryFilter,setCategoryFilter]= useState('all');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [roleFilter,    setRoleFilter]    = useState('all');

  // UI states
  const [printMode,  setPrintMode]  = useState(false);
  const [exporting,  setExporting]  = useState(null); // track which export is running

  // ── Real-time listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    let resolved = 0;
    const check = () => { resolved++; if (resolved >= 4) setLoading(false); };

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => { setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); check(); },
      (err)  => { console.error(err); setError('Failed to load users.'); setLoading(false); }
    );
    const unsubBiz = onSnapshot(
      collection(db, 'businesses'),
      (snap) => { setBusinesses(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); check(); },
      (err)  => { console.error(err); setError('Failed to load businesses.'); setLoading(false); }
    );
    const unsubBookings = onSnapshot(
      collection(db, 'bookings'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setBookings(list);
        check();
      },
      (err) => { console.error(err); setError('Failed to load bookings.'); setLoading(false); }
    );
    const unsubReviews = onSnapshot(
      collection(db, 'reviews'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setReviews(list);
        check();
      },
      (err) => { console.error(err); setError('Failed to load reviews.'); setLoading(false); }
    );

    return () => { unsubUsers(); unsubBiz(); unsubBookings(); unsubReviews(); };
  }, []);

  // ── Date Range helpers ───────────────────────────────────────────────────────
  const isInRange = (ts) => {
    if (!ts) return true;
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
      const to   = dateTo   ? new Date(dateTo   + 'T23:59:59') : null;
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      return true;
    } catch { return true; }
  };

  // ── Derived: categories & statuses ──────────────────────────────────────────
  const categories = useMemo(() => {
    const cats = new Set(businesses.map((b) => b.category).filter(Boolean));
    return ['all', ...Array.from(cats)];
  }, [businesses]);

  const bookingStatuses = ['all', 'pending', 'confirmed', 'active', 'served', 'cancelled'];
  const userRoles       = ['all', 'customer', 'business', 'admin'];

  // ── Filtered datasets ─────────────────────────────────────────────────────────
  const filteredBookings = useMemo(() =>
    bookings.filter((b) => {
      if (!isInRange(b.createdAt)) return false;
      if (statusFilter   !== 'all' && b.status   !== statusFilter)   return false;
      if (categoryFilter !== 'all') {
        const biz = businesses.find((bz) => bz.id === b.businessId);
        if (!biz || biz.category !== categoryFilter) return false;
      }
      return true;
    }),
  [bookings, businesses, dateFrom, dateTo, statusFilter, categoryFilter]);

  const filteredBusinesses = useMemo(() =>
    businesses.filter((b) => {
      if (categoryFilter !== 'all' && b.category !== categoryFilter) return false;
      return true;
    }),
  [businesses, categoryFilter]);

  const filteredUsers = useMemo(() =>
    users.filter((u) => {
      if (!isInRange(u.createdAt)) return false;
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      return true;
    }),
  [users, dateFrom, dateTo, roleFilter]);

  const filteredReviews = useMemo(() =>
    reviews.filter((r) => {
      if (!isInRange(r.createdAt)) return false;
      if (categoryFilter !== 'all') {
        const biz = businesses.find((b) => b.id === r.businessId);
        if (!biz || biz.category !== categoryFilter) return false;
      }
      return true;
    }),
  [reviews, businesses, dateFrom, dateTo, categoryFilter]);

  // ── Summary metrics (on filtered data) ───────────────────────────────────────
  const metrics = useMemo(() => {
    const totalBookings    = filteredBookings.length;
    const completedBookings= filteredBookings.filter((b) => b.status === 'served').length;
    const cancelledBookings= filteredBookings.filter((b) => b.status === 'cancelled').length;
    const totalBusinesses  = filteredBusinesses.length;
    const totalUsers       = filteredUsers.length;
    const validRatings     = filteredBusinesses.filter((b) => b.rating && parseFloat(b.rating) > 0);
    const avgRating        = validRatings.length
      ? (validRatings.reduce((s, b) => s + parseFloat(b.rating), 0) / validRatings.length).toFixed(1)
      : '—';
    return { totalBookings, completedBookings, cancelledBookings, totalBusinesses, totalUsers, avgRating };
  }, [filteredBookings, filteredBusinesses, filteredUsers]);

  // ── CSV Column Definitions ───────────────────────────────────────────────────
  const bookingColumns = [
    { label: 'Token',          value: (r) => r.tokenNumber || '' },
    { label: 'Customer Name',  value: (r) => r.customerName || '' },
    { label: 'Customer ID',    value: (r) => r.customerId   || '' },
    { label: 'Business Name',  value: (r) => r.businessName || '' },
    { label: 'Business ID',    value: (r) => r.businessId   || '' },
    { label: 'Service',        value: (r) => r.serviceName  || '' },
    { label: 'Staff',          value: (r) => r.staffName    || '' },
    { label: 'Status',         value: (r) => r.status       || '' },
    { label: 'Price (₹)',      value: (r) => r.price        ?? '' },
    { label: 'Date',           value: (r) => fmtDate(r.selectedDate || r.createdAt) },
    { label: 'Time Slot',      value: (r) => r.selectedTime || '' },
    { label: 'Created At',     value: (r) => fmtDate(r.createdAt) },
  ];

  const businessColumns = [
    { label: 'Business ID',    value: (r) => r.id           || '' },
    { label: 'Name',           value: (r) => r.name         || '' },
    { label: 'Owner ID',       value: (r) => r.ownerId      || '' },
    { label: 'Category',       value: (r) => r.category     || '' },
    { label: 'Address',        value: (r) => r.address      || '' },
    { label: 'Phone',          value: (r) => r.phone        || '' },
    { label: 'Rating',         value: (r) => r.rating       ?? '' },
    { label: 'Review Count',   value: (r) => r.reviewCount  ?? '' },
    { label: 'Is Verified',    value: (r) => r.isVerified ? 'Yes' : 'No' },
    { label: 'Is Open',        value: (r) => r.isOpen       ? 'Yes' : 'No' },
    { label: 'Plan',           value: (r) => r.plan         || 'free' },
    { label: 'Current Queue',  value: (r) => r.currentQueue ?? 0 },
  ];

  const userColumns = [
    { label: 'User ID',        value: (r) => r.id           || '' },
    { label: 'Name',           value: (r) => r.name         || '' },
    { label: 'Email',          value: (r) => r.email        || '' },
    { label: 'Phone',          value: (r) => r.phone        || '' },
    { label: 'Role',           value: (r) => r.role         || '' },
    { label: 'Joined At',      value: (r) => fmtDate(r.createdAt) },
  ];

  const reviewColumns = [
    { label: 'Review ID',      value: (r) => r.id              || '' },
    { label: 'Customer Name',  value: (r) => r.customerName    || '' },
    { label: 'Business Name',  value: (r) => r.businessName    || '' },
    { label: 'Rating',         value: (r) => r.rating          ?? '' },
    { label: 'Comment',        value: (r) => r.comment         || '' },
    { label: 'Has Reply',      value: (r) => r.replyText ? 'Yes' : 'No' },
    { label: 'Reply',          value: (r) => r.replyText       || '' },
    { label: 'Created At',     value: (r) => fmtDate(r.createdAt) },
  ];

  // ── Export handlers ──────────────────────────────────────────────────────────
  const handleExport = (type) => {
    setExporting(type);
    try {
      const stamp = new Date().toISOString().split('T')[0];
      if (type === 'bookings') {
        downloadCSV(toCSV(filteredBookings, bookingColumns), `queueless_bookings_${stamp}.csv`);
      } else if (type === 'businesses') {
        downloadCSV(toCSV(filteredBusinesses, businessColumns), `queueless_businesses_${stamp}.csv`);
      } else if (type === 'users') {
        downloadCSV(toCSV(filteredUsers, userColumns), `queueless_users_${stamp}.csv`);
      } else if (type === 'reviews') {
        downloadCSV(toCSV(filteredReviews, reviewColumns), `queueless_reviews_${stamp}.csv`);
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setTimeout(() => setExporting(null), 600);
    }
  };

  // ── Print handler ────────────────────────────────────────────────────────────
  const handlePrint = () => {
    setPrintMode(true);
    setTimeout(() => window.print(), 300);
  };

  // ─── UI State: Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rp-wrapper animate-fade-in">
        <div className="rp-header">
          <div className="rp-skel-line" style={{ width: '260px', height: '32px' }} />
          <div className="rp-skel-line" style={{ width: '180px', height: '14px', marginTop: '8px' }} />
        </div>
        <div className="rp-summary-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-panel rp-card nt-skeleton" style={{ height: '86px' }} />
          ))}
        </div>
        <div className="glass-panel rp-table-card">
          <table className="rp-table">
            <thead><tr>{Array.from({ length: 5 }).map((_, i) => <th key={i}><div className="rp-skel-cell" /></th>)}</tr></thead>
            <SkeletonRows rows={6} cols={5} />
          </table>
        </div>
      </div>
    );
  }

  // ─── UI State: Error ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rp-state-center glass-panel animate-fade-in">
        <AlertTriangle size={42} className="rp-warn-icon" />
        <h2>Report Engine Error</h2>
        <p>{error}</p>
        <button className="btn-primary rp-retry-btn" onClick={() => window.location.reload()}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  // ─── Active report dataset ────────────────────────────────────────────────────
  const reportConfig = {
    bookings:   { data: filteredBookings,   cols: bookingColumns,  label: 'Bookings'   },
    businesses: { data: filteredBusinesses, cols: businessColumns, label: 'Businesses' },
    users:      { data: filteredUsers,      cols: userColumns,     label: 'Users'      },
    reviews:    { data: filteredReviews,    cols: reviewColumns,   label: 'Reviews'    },
  };
  const { data: tableData, cols: tableCols } = reportConfig[activeReport];

  const reportTabs = [
    { key: 'bookings',   label: 'Bookings',   count: filteredBookings.length   },
    { key: 'businesses', label: 'Businesses', count: filteredBusinesses.length },
    { key: 'users',      label: 'Users',      count: filteredUsers.length      },
    { key: 'reviews',    label: 'Reviews',    count: filteredReviews.length    },
  ];

  return (
    <>
      <div className={`rp-wrapper animate-fade-in ${printMode ? 'rp-print-active' : ''}`} ref={printRef}>

        {/* ── Page Header ────────────────────────────────────────────────────── */}
        <header className="rp-header">
          <div className="rp-header-left">
            <button className="rp-back-btn" onClick={() => navigate('/admin')} title="Back to Admin Dashboard">
              <ArrowLeft size={16} /> Admin Dashboard
            </button>
            <span className="rp-eyebrow"><Sparkles size={12} /> Reports & Analytics</span>
            <h1 className="rp-title">Data Export Centre</h1>
            <p className="rp-subtitle">
              Filter platform data by date, category, and status — then export to CSV.
            </p>
          </div>
          <div className="rp-header-actions">
            <button className="rp-action-btn" onClick={handlePrint} title="Print Report">
              <Printer size={16} /> Print Report
            </button>
          </div>
        </header>

        {/* ── Filters Bar ────────────────────────────────────────────────────── */}
        <section className="glass-panel rp-filters" aria-label="Report filters">
          <div className="rp-filters-title">
            <Filter size={14} /> Filters
          </div>
          <div className="rp-filters-row">
            {/* Date From */}
            <div className="rp-filter-group">
              <label className="rp-filter-label">From</label>
              <input
                type="date"
                className="rp-filter-input"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            {/* Date To */}
            <div className="rp-filter-group">
              <label className="rp-filter-label">To</label>
              <input
                type="date"
                className="rp-filter-input"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {/* Category */}
            <div className="rp-filter-group">
              <label className="rp-filter-label">Category</label>
              <div className="rp-select-wrap">
                <select
                  className="rp-filter-select"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="rp-select-icon" />
              </div>
            </div>

            {/* Booking Status */}
            <div className="rp-filter-group">
              <label className="rp-filter-label">Booking Status</label>
              <div className="rp-select-wrap">
                <select
                  className="rp-filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {bookingStatuses.map((s) => (
                    <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="rp-select-icon" />
              </div>
            </div>

            {/* User Role */}
            <div className="rp-filter-group">
              <label className="rp-filter-label">User Role</label>
              <div className="rp-select-wrap">
                <select
                  className="rp-filter-select"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  {userRoles.map((r) => (
                    <option key={r} value={r}>{r === 'all' ? 'All Roles' : r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="rp-select-icon" />
              </div>
            </div>

            {/* Reset */}
            <button
              className="rp-reset-btn"
              onClick={() => {
                setDateFrom(thirtyAgo.toISOString().split('T')[0]);
                setDateTo(today.toISOString().split('T')[0]);
                setCategoryFilter('all');
                setStatusFilter('all');
                setRoleFilter('all');
              }}
              title="Reset all filters"
            >
              <RefreshCw size={13} /> Reset
            </button>
          </div>
        </section>

        {/* ── Summary Cards ───────────────────────────────────────────────────── */}
        <section className="rp-summary-grid" aria-label="Report summary">
          <SummaryCard icon={CalendarDays} label="Total Bookings"    value={metrics.totalBookings}     sub="in date range"    accent="var(--primary)" />
          <SummaryCard icon={CheckCircle2} label="Completed"         value={metrics.completedBookings} sub="served"           accent="#4CAF50" />
          <SummaryCard icon={XCircle}      label="Cancelled"         value={metrics.cancelledBookings} sub="aborted"          accent="#EF5350" />
          <SummaryCard icon={Building2}    label="Businesses"        value={metrics.totalBusinesses}   sub="in report scope"  accent="#00E6B4" />
          <SummaryCard icon={Users}        label="Users"             value={metrics.totalUsers}        sub="in date range"    accent="#74B9FF" />
          <SummaryCard icon={Star}         label="Avg Rating"        value={metrics.avgRating}         sub="platform average" accent="#FFC107" />
        </section>

        {/* ── Export Buttons ──────────────────────────────────────────────────── */}
        <section className="rp-export-section" aria-label="Export actions">
          <h2 className="rp-section-title"><FileSpreadsheet size={16} /> Export to CSV</h2>
          <div className="rp-export-grid">
            <ExportBtn
              icon={CalendarDays}
              label="Export Bookings"
              count={filteredBookings.length}
              accent="var(--primary)"
              disabled={exporting === 'bookings' || filteredBookings.length === 0}
              onClick={() => handleExport('bookings')}
            />
            <ExportBtn
              icon={Building2}
              label="Export Businesses"
              count={filteredBusinesses.length}
              accent="#00E6B4"
              disabled={exporting === 'businesses' || filteredBusinesses.length === 0}
              onClick={() => handleExport('businesses')}
            />
            <ExportBtn
              icon={Users}
              label="Export Users"
              count={filteredUsers.length}
              accent="#74B9FF"
              disabled={exporting === 'users' || filteredUsers.length === 0}
              onClick={() => handleExport('users')}
            />
            <ExportBtn
              icon={Star}
              label="Export Reviews"
              count={filteredReviews.length}
              accent="#FFC107"
              disabled={exporting === 'reviews' || filteredReviews.length === 0}
              onClick={() => handleExport('reviews')}
            />
          </div>
        </section>

        {/* ── Data Preview Table ──────────────────────────────────────────────── */}
        <section className="rp-preview-section">
          <div className="rp-preview-header">
            <h2 className="rp-section-title"><BarChart3 size={16} /> Data Preview</h2>
            {/* Report Tabs */}
            <div className="rp-tabs" role="tablist">
              {reportTabs.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={activeReport === t.key}
                  className={`rp-tab-btn ${activeReport === t.key ? 'active' : ''}`}
                  onClick={() => setActiveReport(t.key)}
                >
                  {t.label}
                  <span className="rp-tab-badge">{t.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel rp-table-card">
            {tableData.length === 0 ? (
              <div className="rp-empty">
                <Inbox size={36} />
                <p>No {activeReport} match the current filters.</p>
                <span>Adjust filters or reset to default range.</span>
              </div>
            ) : (
              <div className="rp-table-scroll">
                <table className="rp-table">
                  <thead>
                    <tr>
                      {tableCols.map((col) => (
                        <th key={col.label}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.slice(0, 50).map((row, idx) => (
                      <tr key={row.id || idx}>
                        {tableCols.map((col) => (
                          <td key={col.label}>{col.value(row) || <span className="rp-empty-cell">—</span>}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tableData.length > 50 && (
                  <div className="rp-table-overflow-note">
                    <TrendingUp size={13} />
                    Showing first 50 of {tableData.length} rows. Export CSV for full data.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Print-Friendly Summary Block (only visible when printing) ─────── */}
        <section className="rp-print-summary">
          <h2>QueueLess Platform Report</h2>
          <p className="rp-print-meta">
            Generated: {new Date().toLocaleString('en-IN')} &nbsp;|&nbsp;
            Range: {dateFrom || '—'} → {dateTo || '—'} &nbsp;|&nbsp;
            Category: {categoryFilter} &nbsp;|&nbsp; Status: {statusFilter}
          </p>
          <div className="rp-print-cards">
            {[
              ['Total Bookings',    metrics.totalBookings],
              ['Completed',         metrics.completedBookings],
              ['Cancelled',         metrics.cancelledBookings],
              ['Total Businesses',  metrics.totalBusinesses],
              ['Total Users',       metrics.totalUsers],
              ['Avg Rating',        metrics.avgRating],
            ].map(([label, val]) => (
              <div key={label} className="rp-print-card">
                <span className="rp-print-card-val">{val}</span>
                <span className="rp-print-card-label">{label}</span>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* ── Scoped Styles ─────────────────────────────────────────────────────── */}
      <style>{`
        /* ── Layout ── */
        .rp-wrapper {
          display: flex;
          flex-direction: column;
          gap: 28px;
          max-width: 1240px;
          margin: 0 auto;
          padding-bottom: 64px;
        }

        /* ── Header ── */
        .rp-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }
        .rp-header-left { display: flex; flex-direction: column; gap: 4px; }
        .rp-back-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);
          background: none; border: none; cursor: pointer;
          padding: 0; margin-bottom: 6px; transition: color 0.2s;
        }
        .rp-back-btn:hover { color: var(--primary); }
        .rp-eyebrow {
          display: flex; align-items: center; gap: 5px;
          font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.08em; color: var(--primary);
        }
        .rp-title { font-size: 2rem; font-weight: 800; color: var(--text-primary); margin: 0; }
        .rp-subtitle { font-size: 0.86rem; color: var(--text-secondary); margin: 0; }
        .rp-header-actions { display: flex; gap: 10px; align-items: center; padding-top: 36px; }
        .rp-action-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; border-radius: 50px;
          border: 1px solid var(--glass-border);
          background: rgba(255,255,255,0.03);
          color: var(--text-secondary); font-size: 0.84rem; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
        }
        .rp-action-btn:hover {
          border-color: rgba(108,99,255,0.35);
          color: var(--primary); background: rgba(108,99,255,0.06);
        }

        /* ── Filters ── */
        .rp-filters {
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .rp-filters-title {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: var(--text-secondary);
        }
        .rp-filters-row {
          display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap;
        }
        .rp-filter-group { display: flex; flex-direction: column; gap: 5px; }
        .rp-filter-label {
          font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--text-secondary);
        }
        .rp-filter-input {
          padding: 8px 12px; border-radius: 8px;
          border: 1px solid var(--glass-border);
          background: rgba(255,255,255,0.03);
          color: var(--text-primary); font-size: 0.83rem; outline: none;
          transition: border-color 0.2s; cursor: pointer;
          color-scheme: dark;
        }
        .rp-filter-input:focus { border-color: rgba(108,99,255,0.4); }
        .rp-select-wrap { position: relative; }
        .rp-filter-select {
          appearance: none; padding: 8px 32px 8px 12px;
          border-radius: 8px; border: 1px solid var(--glass-border);
          background: rgba(255,255,255,0.03);
          color: var(--text-primary); font-size: 0.83rem; outline: none;
          cursor: pointer; transition: border-color 0.2s; min-width: 140px;
        }
        .rp-filter-select:focus { border-color: rgba(108,99,255,0.4); }
        .rp-filter-select option { background: #141124; color: var(--text-primary); }
        .rp-select-icon {
          position: absolute; right: 10px; top: 50%;
          transform: translateY(-50%); color: var(--text-secondary); pointer-events: none;
        }
        .rp-reset-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 50px; margin-bottom: 0; align-self: flex-end;
          border: 1px solid rgba(239,83,80,0.2);
          background: rgba(239,83,80,0.04);
          color: #EF5350; font-size: 0.8rem; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
        }
        .rp-reset-btn:hover { background: rgba(239,83,80,0.1); border-color: rgba(239,83,80,0.4); }

        /* ── Summary Cards ── */
        .rp-summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 16px;
        }
        .rp-card {
          padding: 16px 18px;
          display: flex; align-items: center; gap: 14px;
          border-left: 3px solid var(--rp-accent, var(--primary));
        }
        .rp-card-icon {
          width: 38px; height: 38px; border-radius: 50%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; color: var(--rp-accent, var(--primary));
        }
        .rp-card-body { display: flex; flex-direction: column; gap: 1px; }
        .rp-card-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); }
        .rp-card-value { font-size: 1.5rem; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
        .rp-card-sub   { font-size: 0.7rem; color: var(--text-secondary); }

        /* ── Export Buttons ── */
        .rp-section-title {
          display: flex; align-items: center; gap: 8px;
          font-size: 0.88rem; font-weight: 700; color: var(--text-primary);
          text-transform: uppercase; letter-spacing: 0.04em; margin: 0;
        }
        .rp-export-section { display: flex; flex-direction: column; gap: 14px; }
        .rp-export-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
        }
        .rp-export-btn {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 18px; border-radius: 12px; text-align: left;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
          cursor: pointer; transition: all 0.22s;
          border-left: 3px solid var(--rp-accent, var(--primary));
        }
        .rp-export-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.12);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        }
        .rp-export-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
        .rp-export-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; color: var(--rp-accent, var(--primary));
        }
        .rp-export-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .rp-export-label { font-size: 0.88rem; font-weight: 700; color: var(--text-primary); }
        .rp-export-count { font-size: 0.72rem; color: var(--text-secondary); }
        .rp-export-dl-icon { color: var(--text-secondary); flex-shrink: 0; }

        /* ── Data Table ── */
        .rp-preview-section { display: flex; flex-direction: column; gap: 14px; }
        .rp-preview-header {
          display: flex; justify-content: space-between; align-items: center;
          gap: 16px; flex-wrap: wrap;
        }
        .rp-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
        .rp-tab-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 7px 16px; border-radius: 50px;
          border: 1px solid var(--glass-border);
          background: rgba(255,255,255,0.02);
          color: var(--text-secondary); font-size: 0.82rem; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
        }
        .rp-tab-btn:hover { border-color: rgba(108,99,255,0.3); color: var(--text-primary); }
        .rp-tab-btn.active {
          background: rgba(108,99,255,0.12);
          border-color: rgba(108,99,255,0.4);
          color: var(--primary);
        }
        .rp-tab-badge {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 20px; height: 18px; padding: 0 5px; border-radius: 50px;
          background: rgba(255,255,255,0.06); font-size: 0.68rem; font-weight: 800;
          color: var(--text-secondary);
        }
        .rp-tab-btn.active .rp-tab-badge {
          background: rgba(108,99,255,0.2); color: var(--primary);
        }

        .rp-table-card { padding: 8px; overflow: hidden; }
        .rp-table-scroll { overflow-x: auto; }
        .rp-table {
          width: 100%; border-collapse: collapse; text-align: left;
          font-size: 0.83rem;
        }
        .rp-table th {
          padding: 12px 14px; font-size: 0.68rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.05em;
          color: var(--text-secondary); border-bottom: 1px solid var(--glass-border);
          white-space: nowrap;
        }
        .rp-table td {
          padding: 12px 14px; color: var(--text-primary);
          border-bottom: 1px solid rgba(255,255,255,0.025);
          vertical-align: middle; max-width: 240px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .rp-table tr:hover td { background: rgba(255,255,255,0.01); }
        .rp-empty-cell { color: var(--text-secondary); }
        .rp-table-overflow-note {
          display: flex; align-items: center; gap: 6px;
          padding: 12px 16px; font-size: 0.76rem; color: var(--text-secondary);
          border-top: 1px solid var(--glass-border);
        }

        /* ── Empty State ── */
        .rp-empty {
          display: flex; flex-direction: column; align-items: center;
          gap: 10px; padding: 64px 24px; text-align: center;
          color: var(--text-secondary);
        }
        .rp-empty p { font-size: 0.92rem; font-weight: 600; color: var(--text-primary); margin: 0; }
        .rp-empty span { font-size: 0.78rem; margin: 0; }

        /* ── Error State ── */
        .rp-state-center {
          display: flex; flex-direction: column; align-items: center;
          gap: 16px; padding: 60px 32px; text-align: center;
          max-width: 460px; margin: 60px auto;
        }
        .rp-state-center h2 { font-size: 1.2rem; color: var(--text-primary); margin: 0; }
        .rp-state-center p  { color: var(--text-secondary); font-size: 0.86rem; margin: 0; }
        .rp-warn-icon { color: #FFC107; }
        .rp-retry-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 24px; border-radius: 50px; font-size: 0.88rem;
        }

        /* ── Skeleton ── */
        .rp-skel-line {
          background: rgba(255,255,255,0.04); border-radius: 4px;
          animation: rp-shimmer 1.4s ease-in-out infinite;
        }
        .rp-skel-cell {
          height: 14px; background: rgba(255,255,255,0.03); border-radius: 3px;
          animation: rp-shimmer 1.4s ease-in-out infinite;
        }
        @keyframes rp-shimmer {
          0%   { opacity: 0.5; }
          50%  { opacity: 1;   }
          100% { opacity: 0.5; }
        }

        /* ── Print Styles ── */
        .rp-print-summary { display: none; }

        @media print {
          /* Hide everything except wrapper */
          body > *:not(.rp-print-root) { display: none; }
          .rp-header-actions,
          .rp-filters,
          .rp-export-section,
          .rp-tabs,
          .rp-back-btn { display: none !important; }

          .rp-wrapper { padding: 0; gap: 16px; }
          .rp-print-summary { display: block !important; }
          .glass-panel { border: 1px solid #ccc; background: #fff; box-shadow: none; }
          .rp-table th, .rp-table td { color: #000; border-color: #ddd; padding: 8px 10px; }
          .rp-title, .rp-subtitle, .rp-eyebrow { color: #000; }
          .rp-section-title { color: #333; }
          .rp-card-value { color: #000; }
          .rp-card-label, .rp-card-sub { color: #555; }
        }

        .rp-print-summary h2 { font-size: 1.4rem; margin-bottom: 4px; }
        .rp-print-meta { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 16px; }
        .rp-print-cards { display: flex; gap: 16px; flex-wrap: wrap; }
        .rp-print-card {
          display: flex; flex-direction: column; align-items: center;
          padding: 14px 20px; border: 1px solid #ddd; border-radius: 8px; min-width: 110px;
        }
        .rp-print-card-val   { font-size: 1.6rem; font-weight: 800; }
        .rp-print-card-label { font-size: 0.72rem; color: #555; text-align: center; margin-top: 4px; }
      `}</style>
    </>
  );
};

export default ReportsExport;
