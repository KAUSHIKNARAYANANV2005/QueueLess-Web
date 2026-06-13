import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import useAuth from '../../hooks/useAuth';
import {
  UserCog,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Phone,
  Calendar,
  ArrowLeft,
  CheckCircle2,
  X,
} from 'lucide-react';

const COMMON_ROLES = [
  'Stylist',
  'Barber',
  'Doctor',
  'Therapist',
  'Consultant',
  'Specialist',
  'Manager',
  'Receptionist',
  'Other',
];

const Skeleton = ({ style = {} }) => (
  <div className="st-skeleton" style={style} />
);

const ManageStaff = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // ─── Core State ──────────────────────────────────────────────────────────
  const [businessId, setBusinessId] = useState(null);
  const [bizName, setBizName] = useState('');
  const [staffList, setStaffList] = useState([]);
  
  const [resolvingBiz, setResolvingBiz] = useState(true);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [error, setError] = useState(null);

  // ─── Form & Modal State ──────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null); // null means Add Mode
  const [formState, setFormState] = useState({
    name: '',
    role: 'Stylist',
    phone: '',
    avatarUrl: '',
    isActive: true,
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // ─── Delete Prompt State ─────────────────────────────────────────────────
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ─── Filters State ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive

  // ─── Notification State ──────────────────────────────────────────────────
  const [notification, setNotification] = useState(null);

  // ─── Step 1: Resolve businessId from ownerId ─────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.uid && currentUser.uid.startsWith('mock-')) {
      setBusinessId('mock-business-id');
      setBizName('Mock Merchant Salon');
      setStaffList([
        { id: 'mock-st1', name: 'John Barber', role: 'Barber', phone: '1234567890', isActive: true, createdAt: new Date() },
        { id: 'mock-st2', name: 'Alice Stylist', role: 'Stylist', phone: '0987654321', isActive: true, createdAt: new Date() },
      ]);
      setResolvingBiz(false);
      setLoadingStaff(false);
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
          setLoadingStaff(false);
          return;
        }
        const d = snap.docs[0];
        setBusinessId(d.id);
        setBizName(d.data()?.name || 'Your Business');
        setResolvingBiz(false);
      })
      .catch((err) => {
        console.error('ManageStaff: Resolve business error', err);
        setError('Failed to resolve business profile.');
        setResolvingBiz(false);
        setLoadingStaff(false);
      });
  }, [currentUser]);

  // ─── Step 2: Real-time listener for staff subcollection ──────────────────
  useEffect(() => {
    if (!businessId) return;
    if (businessId.startsWith('mock-')) return;
    const staffRef = collection(db, 'businesses', businessId, 'staff');
    const unsub = onSnapshot(
      staffRef,
      (snap) => {
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        // Sort by name
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setStaffList(list);
        setLoadingStaff(false);
      },
      (err) => {
        console.error('ManageStaff: Staff listener error', err);
        setLoadingStaff(false);
      }
    );
    return () => unsub();
  }, [businessId]);

  // ─── Notification Helper ─────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // ─── Open Add Modal ──────────────────────────────────────────────────────
  const handleOpenAdd = () => {
    setEditingMember(null);
    setFormState({
      name: '',
      role: 'Stylist',
      phone: '',
      avatarUrl: '',
      isActive: true,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // ─── Open Edit Modal ─────────────────────────────────────────────────────
  const handleOpenEdit = (member) => {
    setEditingMember(member);
    setFormState({
      name: member.name || '',
      role: member.role || 'Stylist',
      phone: member.phone || '',
      avatarUrl: member.avatarUrl || member.avatar || member.profileImage || '',
      isActive: member.isActive !== false,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // ─── Form Submit handler (Add/Edit) ──────────────────────────────────────
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const { name, role, phone, avatarUrl, isActive } = formState;

    // Validation
    if (!name.trim()) {
      setFormError('Staff name is required.');
      return;
    }
    if (!role.trim()) {
      setFormError('Staff role is required.');
      return;
    }
    // Phone is optional, but must be 10 digits if provided
    if (phone.trim()) {
      const cleanPhone = phone.trim().replace(/\s+/g, '');
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(cleanPhone)) {
        setFormError('Phone number must be a valid 10-digit number.');
        return;
      }
    }

    setSaving(true);
    try {
      const staffData = {
        name: name.trim(),
        role: role.trim(),
        phone: phone.trim() ? phone.trim() : '',
        avatarUrl: avatarUrl.trim() ? avatarUrl.trim() : '',
        avatar: avatarUrl.trim() ? avatarUrl.trim() : '', // Duplicate field to support various schema formats
        isActive,
        isAvailable: isActive, // Maintain compatibility
        updatedAt: new Date(),
      };

      if (businessId.startsWith('mock-')) {
        const mockMember = {
          id: editingMember ? editingMember.id : 'mock-st' + (staffList.length + 1),
          ...staffData,
          createdAt: new Date(),
        };
        if (editingMember) {
          setStaffList(prev => prev.map(m => m.id === editingMember.id ? mockMember : m));
          showToast('Staff member updated successfully.');
        } else {
          setStaffList(prev => [...prev, mockMember]);
          showToast('New staff member added successfully.');
        }
        setIsModalOpen(false);
        setSaving(false);
        return;
      }

      if (editingMember) {
        // Edit mode
        const docRef = doc(db, 'businesses', businessId, 'staff', editingMember.id);
        await updateDoc(docRef, { ...staffData, updatedAt: serverTimestamp() });
        showToast('Staff member updated successfully.');
      } else {
        // Add mode
        const colRef = collection(db, 'businesses', businessId, 'staff');
        await addDoc(colRef, {
          ...staffData,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
        showToast('New staff member added successfully.');
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('ManageStaff: Save error', err);
      setFormError(err.message || 'Failed to save staff details.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle Status Switcher ──────────────────────────────────────────────
  const handleToggleStatus = async (member) => {
    if (!businessId) return;
    const newStatus = member.isActive === false ? true : false;
    if (businessId.startsWith('mock-')) {
      setStaffList(prev => prev.map(m => m.id === member.id ? { ...m, isActive: newStatus, isAvailable: newStatus } : m));
      showToast(`${member.name} marked as ${newStatus ? 'active' : 'inactive'}.`);
      return;
    }
    try {
      const docRef = doc(db, 'businesses', businessId, 'staff', member.id);
      await updateDoc(docRef, {
        isActive: newStatus,
        isAvailable: newStatus,
        updatedAt: serverTimestamp(),
      });
      showToast(`${member.name} marked as ${newStatus ? 'active' : 'inactive'}.`);
    } catch (err) {
      console.error('ManageStaff: Toggle status error', err);
      showToast('Failed to toggle active status.', 'error');
    }
  };

  // ─── Delete operations ───────────────────────────────────────────────────
  const handleDeleteTrigger = (id) => {
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!businessId || !deleteConfirmId) return;
    if (businessId.startsWith('mock-')) {
      setStaffList(prev => prev.filter(m => m.id !== deleteConfirmId));
      showToast('Staff member removed from directory.');
      setDeleteConfirmId(null);
      return;
    }
    setDeleting(true);
    try {
      const docRef = doc(db, 'businesses', businessId, 'staff', deleteConfirmId);
      await deleteDoc(docRef);
      showToast('Staff member removed from directory.');
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('ManageStaff: Delete error', err);
      showToast('Failed to remove staff member.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Derived Filters ─────────────────────────────────────────────────────
  const filteredStaff = useMemo(() => {
    return staffList.filter((st) => {
      const matchSearch =
        (st.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (st.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (st.phone || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && st.isActive !== false) ||
        (statusFilter === 'inactive' && st.isActive === false);

      return matchSearch && matchStatus;
    });
  }, [staffList, searchQuery, statusFilter]);

  const formatDate = (ts) => {
    if (!ts) return 'N/A';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // ─── Render States ───────────────────────────────────────────────────────

  // Loading indicator
  if (resolvingBiz || (loadingStaff && staffList.length === 0 && !error)) {
    return (
      <div className="st-wrapper animate-fade-in">
        <div className="st-skel-header">
          <Skeleton style={{ width: 100, height: 12 }} />
          <Skeleton style={{ width: 260, height: 32, marginTop: 10 }} />
        </div>
        <div className="st-skel-bar">
          <Skeleton style={{ width: '40%', height: 42, borderRadius: 8 }} />
          <Skeleton style={{ width: '30%', height: 42, borderRadius: 8 }} />
          <Skeleton style={{ width: 140, height: 42, borderRadius: 24, marginLeft: 'auto' }} />
        </div>
        <div className="st-grid">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-panel st-card">
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
                <Skeleton style={{ width: 48, height: 48, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <Skeleton style={{ width: '60%', height: 18, marginBottom: 6 }} />
                  <Skeleton style={{ width: '40%', height: 12 }} />
                </div>
              </div>
              <Skeleton style={{ height: 14, marginBottom: 8 }} />
              <Skeleton style={{ height: 14, marginBottom: 16 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Skeleton style={{ width: 80, height: 28, borderRadius: 20 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Skeleton style={{ width: 28, height: 28, borderRadius: 6 }} />
                  <Skeleton style={{ width: 28, height: 28, borderRadius: 6 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error block
  if (error) {
    return (
      <div className="st-state-center glass-panel animate-fade-in">
        <AlertTriangle size={44} className="st-icon-warn" />
        <h2>Directory Unavailable</h2>
        <p>{error}</p>
        <button className="btn-primary st-state-btn" onClick={() => window.location.reload()}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {/* ─── TOAST NOTIFICATION ─── */}
      {notification && (
        <div className={`st-toast ${notification.type} animate-fade-in`}>
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* ─── DELETE CONFIRM MODAL ─── */}
      {deleteConfirmId && (
        <div className="st-modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="st-modal delete-modal glass-panel animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="st-modal-icon danger">
              <AlertTriangle size={24} />
            </div>
            <h3>Remove Staff Member?</h3>
            <p>
              Are you sure you want to remove this staff member from your directory? 
              <br />
              <span className="warning-note">
                <strong>Warning:</strong> Customers will no longer be able to select this staff member for bookings. Active bookings assigned to this member will remain in the system.
              </span>
            </p>
            <div className="st-modal-actions">
              <button className="st-btn-cancel" onClick={() => setDeleteConfirmId(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="st-btn-confirm danger" onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? <Loader2 size={14} className="st-spinner" /> : 'Remove Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD / EDIT MODAL ─── */}
      {isModalOpen && (
        <div className="st-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="st-modal form-modal glass-panel animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <header className="st-modal-header">
              <h3>{editingMember ? 'Edit Staff Profile' : 'Add Staff Member'}</h3>
              <button className="st-close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </header>

            <form onSubmit={handleFormSubmit} className="st-form">
              {formError && (
                <div className="st-form-error">
                  <AlertTriangle size={14} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="st-form-group">
                <label htmlFor="staff-name">Staff Name *</label>
                <input
                  id="staff-name"
                  type="text"
                  placeholder="e.g. John Doe"
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  required
                />
              </div>

              <div className="st-form-row">
                <div className="st-form-group">
                  <label htmlFor="staff-role">Role *</label>
                  <select
                    id="staff-role"
                    value={formState.role}
                    onChange={(e) => setFormState({ ...formState, role: e.target.value })}
                  >
                    {COMMON_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="st-form-group">
                  <label htmlFor="staff-phone">Contact Phone (10-digit)</label>
                  <input
                    id="staff-phone"
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={formState.phone}
                    onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="st-form-row">
                <div className="st-form-group">
                  <label htmlFor="staff-avatar">Avatar Image URL</label>
                  <input
                    id="staff-avatar"
                    type="url"
                    placeholder="https://example.com/avatar.jpg"
                    value={formState.avatarUrl}
                    onChange={(e) => setFormState({ ...formState, avatarUrl: e.target.value })}
                  />
                </div>

                <div className="st-form-group toggle-group">
                  <label>Work Status</label>
                  <div className="st-switch-wrapper">
                    <button
                      type="button"
                      className={`st-custom-switch ${formState.isActive ? 'on' : 'off'}`}
                      onClick={() => setFormState({ ...formState, isActive: !formState.isActive })}
                    >
                      <span className="st-switch-knob" />
                    </button>
                    <span className="st-switch-label">
                      {formState.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <footer className="st-form-footer">
                <button
                  type="button"
                  className="st-btn-cancel"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary st-btn-save" disabled={saving}>
                  {saving ? <Loader2 size={16} className="st-spinner" /> : null}
                  <span>{editingMember ? 'Save Changes' : 'Add Staff'}</span>
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT ─── */}
      <div className="st-wrapper animate-fade-in">
        {/* Header */}
        <header className="st-header">
          <div className="st-header-left">
            <button className="st-back-btn" onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={15} />
              Dashboard
            </button>
            <span className="st-eyebrow">Staff Directory</span>
            <h1 className="st-title">{bizName} Team</h1>
          </div>
          <button className="btn-primary st-add-btn" onClick={handleOpenAdd}>
            <Plus size={16} />
            <span>Add Member</span>
          </button>
        </header>

        {/* Toolbar */}
        <div className="st-toolbar glass-panel">
          <div className="st-search-wrap">
            <Search size={16} className="st-search-icon" />
            <input
              type="text"
              placeholder="Search by name, role, or contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="st-filters">
            <button
              className={`st-filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All
            </button>
            <button
              className={`st-filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              Active
            </button>
            <button
              className={`st-filter-btn ${statusFilter === 'inactive' ? 'active' : ''}`}
              onClick={() => setStatusFilter('inactive')}
            >
              Inactive
            </button>
          </div>
        </div>

        {/* Staff Listing */}
        {filteredStaff.length === 0 ? (
          <div className="st-empty glass-panel">
            <UserCog size={40} className="st-empty-icon" />
            <h3>No Staff Members</h3>
            {staffList.length === 0 ? (
              <p>Your team directory is empty. Build your squad by adding your first staff member!</p>
            ) : (
              <p>No staff matches your active search queries or filters.</p>
            )}
            {staffList.length === 0 && (
              <button className="btn-primary st-empty-btn" onClick={handleOpenAdd}>
                <Plus size={16} /> Add First Member
              </button>
            )}
          </div>
        ) : (
          <div className="st-grid">
            {filteredStaff.map((member) => {
              const isActive = member.isActive !== false;
              const avatar = member.avatarUrl || member.avatar || member.profileImage;
              return (
                <div
                  key={member.id}
                  className={`st-card glass-panel ${!isActive ? 'inactive-card' : ''}`}
                >
                  <div className="st-card-body">
                    <div className="st-profile-row">
                      {avatar ? (
                        <img src={avatar} alt={member.name} className="st-avatar-img" />
                      ) : (
                        <div className="st-initials">
                          {(member.name || 'S')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="st-meta">
                        <h3 className="st-card-name" title={member.name}>
                          {member.name}
                        </h3>
                        <span className="st-card-role">{member.role || 'Specialist'}</span>
                      </div>
                    </div>

                    <div className="st-contacts">
                      <div className="st-contact-item">
                        <Phone size={12} />
                        <span>{member.phone || 'No phone provided'}</span>
                      </div>
                      <div className="st-contact-item">
                        <Calendar size={12} />
                        <span>Joined: {formatDate(member.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="st-card-footer">
                    <div className="st-status-toggle">
                      <button
                        className={`st-mini-switch ${isActive ? 'active' : ''}`}
                        onClick={() => handleToggleStatus(member)}
                        title={isActive ? 'Deactivate staff' : 'Activate staff'}
                      >
                        <span className="st-mini-switch-knob" />
                      </button>
                      <span className={`st-status-label ${isActive ? 'active' : 'inactive'}`}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="st-card-actions">
                      <button
                        className="st-action-icon-btn edit"
                        onClick={() => handleOpenEdit(member)}
                        title="Edit staff details"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="st-action-icon-btn delete"
                        onClick={() => handleDeleteTrigger(member.id)}
                        title="Delete staff member"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scoped styling for clean aesthetics */}
      <style>{`
        .st-wrapper {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 1100px;
          margin: 0 auto;
          padding-bottom: 60px;
        }

        /* ─── Header ──────────────────────────────────────────── */
        .st-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .st-header-left {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .st-back-btn {
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

        .st-back-btn:hover {
          color: var(--primary);
        }

        .st-eyebrow {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--primary);
        }

        .st-title {
          font-size: 1.9rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0;
          line-height: 1.15;
        }

        .st-add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          border-radius: 50px;
          font-size: 0.88rem;
          font-weight: 700;
        }

        /* ─── Toolbar ─────────────────────────────────────────── */
        .st-toolbar {
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .st-search-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          padding: 8px 14px;
          width: 380px;
          max-width: 100%;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .st-search-wrap:focus-within {
          border-color: rgba(108, 99, 255, 0.45);
          box-shadow: 0 0 10px rgba(108, 99, 255, 0.1);
        }

        .st-search-icon {
          color: var(--text-secondary);
          flex-shrink: 0;
        }

        .st-search-wrap input {
          background: none;
          border: none;
          color: var(--text-primary);
          font-size: 0.88rem;
          width: 100%;
          outline: none;
        }

        .st-search-wrap input::placeholder {
          color: var(--text-secondary);
          opacity: 0.8;
        }

        .st-filters {
          display: flex;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          padding: 4px;
          border-radius: 50px;
        }

        .st-filter-btn {
          border: none;
          background: none;
          color: var(--text-secondary);
          padding: 6px 16px;
          border-radius: 50px;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .st-filter-btn.active {
          background: rgba(108, 99, 255, 0.12);
          color: var(--primary);
        }

        /* ─── Grid & Cards ────────────────────────────────────── */
        .st-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        .st-card {
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 16px;
          transition: all 0.25s ease;
          position: relative;
        }

        .st-card:hover {
          transform: translateY(-3px);
          border-color: rgba(108, 99, 255, 0.28);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
        }

        .st-card.inactive-card {
          opacity: 0.65;
        }

        .st-card-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .st-profile-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .st-avatar-img {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--glass-border);
        }

        .st-initials {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--teal));
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.15rem;
          font-weight: 700;
          border: 2px solid var(--glass-border);
        }

        .st-meta {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .st-card-name {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .st-card-role {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--primary);
          background: rgba(108, 99, 255, 0.1);
          border: 1px solid rgba(108, 99, 255, 0.2);
          padding: 1px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          align-self: flex-start;
        }

        .st-contacts {
          display: flex;
          flex-direction: column;
          gap: 6px;
          border-top: 1px solid var(--glass-border);
          padding-top: 12px;
        }

        .st-contact-item {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 600;
        }

        .st-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 12px;
          border-top: 1px solid var(--glass-border);
        }

        /* ─── Switch / Toggles ────────────────────────────────── */
        .st-status-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .st-mini-switch {
          width: 32px;
          height: 18px;
          border-radius: 50px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--glass-border);
          position: relative;
          cursor: pointer;
          transition: all 0.2s;
          padding: 0;
        }

        .st-mini-switch.active {
          background: rgba(0, 230, 180, 0.16);
          border-color: rgba(0, 230, 180, 0.4);
        }

        .st-mini-switch-knob {
          position: absolute;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--text-secondary);
          top: 2px;
          left: 2px;
          transition: transform 0.2s, background-color 0.2s;
        }

        .st-mini-switch.active .st-mini-switch-knob {
          transform: translateX(14px);
          background: var(--teal);
        }

        .st-status-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .st-status-label.active {
          color: var(--teal);
        }

        .st-status-label.inactive {
          color: var(--text-secondary);
        }

        .st-card-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .st-action-icon-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .st-action-icon-btn:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.08);
        }

        .st-action-icon-btn.edit:hover {
          border-color: rgba(108, 99, 255, 0.35);
          color: var(--primary);
        }

        .st-action-icon-btn.delete:hover {
          border-color: rgba(239, 83, 80, 0.35);
          color: #EF5350;
        }

        /* ─── Empty state ──────────────────────────────────────── */
        .st-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
          padding: 60px 24px;
        }

        .st-empty-icon {
          color: var(--primary);
          opacity: 0.25;
        }

        .st-empty h3 {
          font-size: 1.15rem;
          margin: 0;
          color: var(--text-primary);
        }

        .st-empty p {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0;
          max-width: 360px;
          line-height: 1.5;
        }

        .st-empty-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 8px 20px;
          border-radius: 50px;
          font-size: 0.82rem;
          font-weight: 700;
          margin-top: 10px;
        }

        /* ─── Modals ───────────────────────────────────────────── */
        .st-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .st-modal {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .st-modal.delete-modal {
          max-width: 440px;
          padding: 30px;
          text-align: center;
          align-items: center;
        }

        .st-modal.form-modal {
          max-width: 500px;
          padding: 24px;
        }

        .st-modal-icon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .st-modal-icon.danger {
          background: rgba(239, 83, 80, 0.12);
          color: #EF5350;
        }

        .st-modal h3 {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .st-modal p {
          font-size: 0.86rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .warning-note {
          display: block;
          margin-top: 12px;
          padding: 10px 14px;
          background: rgba(239, 83, 80, 0.05);
          border: 1px solid rgba(239, 83, 80, 0.15);
          border-radius: 6px;
          color: #EF5350;
          font-size: 0.78rem;
          text-align: left;
        }

        .st-modal-actions {
          display: flex;
          gap: 10px;
          width: 100%;
          margin-top: 10px;
        }

        /* ─── Forms ────────────────────────────────────────────── */
        .st-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 14px;
        }

        .st-close-btn {
          border: none;
          background: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 2px;
          border-radius: 4px;
          transition: background 0.15s;
        }

        .st-close-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-primary);
        }

        .st-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .st-form-error {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239, 83, 80, 0.08);
          border: 1px solid rgba(239, 83, 80, 0.25);
          color: #EF5350;
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .st-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .st-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        @media (max-width: 480px) {
          .st-form-row {
            grid-template-columns: 1fr;
          }
        }

        .st-form-group label {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text-secondary);
        }

        .st-form-group input,
        .st-form-group select,
        .st-form-group textarea {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 0.88rem;
          color: var(--text-primary);
          outline: none;
          width: 100%;
          transition: border-color 0.2s;
        }

        .st-form-group input:focus,
        .st-form-group select:focus,
        .st-form-group textarea:focus {
          border-color: rgba(108, 99, 255, 0.45);
        }

        .st-form-group textarea {
          resize: vertical;
        }

        .toggle-group {
          justify-content: flex-end;
          padding-bottom: 2px;
        }

        /* Form Switches */
        .st-switch-wrapper {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 4px;
          height: 38px;
        }

        .st-custom-switch {
          width: 44px;
          height: 22px;
          border-radius: 50px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          position: relative;
          cursor: pointer;
          transition: all 0.2s;
          padding: 0;
          flex-shrink: 0;
        }

        .st-custom-switch.on {
          background: rgba(0, 230, 180, 0.16);
          border-color: rgba(0, 230, 180, 0.4);
        }

        .st-switch-knob {
          position: absolute;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--text-secondary);
          top: 2px;
          left: 2px;
          transition: transform 0.2s, background-color 0.2s;
        }

        .st-custom-switch.on .st-switch-knob {
          transform: translateX(22px);
          background: var(--teal);
        }

        .st-switch-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .st-form-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          border-top: 1px solid var(--glass-border);
          padding-top: 14px;
          margin-top: 6px;
        }

        /* Buttons */
        .st-btn-cancel {
          padding: 9px 20px;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .st-btn-cancel:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary);
        }

        .st-btn-confirm {
          padding: 9px 20px;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s;
          color: #fff;
        }

        .st-btn-confirm.danger {
          background: #EF5350;
          box-shadow: 0 4px 12px rgba(239, 83, 80, 0.3);
        }

        .st-btn-confirm.danger:hover {
          background: #e53935;
        }

        .st-btn-save {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 9px 20px;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 700;
        }

        /* ─── Toast alerts ─────────────────────────────────────── */
        .st-toast {
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
          animation: st-slide-in 0.3s ease;
        }

        @keyframes st-slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .st-toast.success {
          background: rgba(76,175,80,0.1);
          border: 1px solid rgba(76,175,80,0.35);
          color: #4CAF50;
          backdrop-filter: blur(8px);
        }

        .st-toast.error {
          background: rgba(239,83,80,0.1);
          border: 1px solid rgba(239,83,80,0.35);
          color: #EF5350;
          backdrop-filter: blur(8px);
        }

        /* ─── State layouts ───────────────────────────────────── */
        .st-state-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 60px 32px;
          text-align: center;
          max-width: 460px;
          margin: 60px auto;
        }

        .st-state-center h2 {
          font-size: 1.3rem;
          color: var(--text-primary);
          margin: 0;
        }

        .st-state-center p {
          color: var(--text-secondary);
          font-size: 0.88rem;
          margin: 0;
          line-height: 1.5;
        }

        .st-icon-warn {
          color: #FFC107;
        }

        .st-state-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          border-radius: 50px;
          font-size: 0.9rem;
          margin-top: 8px;
        }

        /* ─── Skeletons ────────────────────────────────────────── */
        .st-skeleton {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.04) 25%,
            rgba(255,255,255,0.09) 50%,
            rgba(255,255,255,0.04) 75%
          );
          background-size: 200% 100%;
          animation: st-shimmer 1.4s ease-in-out infinite;
          border-radius: 4px;
          width: 100%;
          height: 14px;
        }

        @keyframes st-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .st-skel-header {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .st-skel-bar {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: 10px 0;
        }

        .st-spinner {
          animation: st-spin 1s linear infinite;
        }

        @keyframes st-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default ManageStaff;
