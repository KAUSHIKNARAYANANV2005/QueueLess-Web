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
  Scissors,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Clock,
  ArrowLeft,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';

const COMMON_CATEGORIES = [
  'Salon',
  'Spa',
  'Clinic',
  'Therapy',
  'Consultation',
  'Government Office',
  'Bank',
  'Other',
];

const Skeleton = ({ style = {} }) => (
  <div className="ms-skeleton" style={style} />
);

const ManageServices = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // ─── Core State ──────────────────────────────────────────────────────────
  const [businessId, setBusinessId] = useState(null);
  const [bizName, setBizName] = useState('');
  const [services, setServices] = useState([]);
  
  const [resolvingBiz, setResolvingBiz] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [error, setError] = useState(null);

  // ─── Form & Modal State ──────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null); // null means Add Mode
  const [formState, setFormState] = useState({
    name: '',
    description: '',
    durationMinutes: '',
    price: '',
    category: 'Salon',
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
      setServices([
        { id: 'mock-s1', name: 'Haircut', category: 'Salon', price: 500, durationMinutes: 30, isActive: true },
        { id: 'mock-s2', name: 'Shaving', category: 'Salon', price: 300, durationMinutes: 20, isActive: true },
      ]);
      setResolvingBiz(false);
      setLoadingServices(false);
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
          setLoadingServices(false);
          return;
        }
        const d = snap.docs[0];
        setBusinessId(d.id);
        setBizName(d.data()?.name || 'Your Business');
        setResolvingBiz(false);
      })
      .catch((err) => {
        console.error('ManageServices: Resolve business error', err);
        setError('Failed to resolve business profile.');
        setResolvingBiz(false);
        setLoadingServices(false);
      });
  }, [currentUser]);

  // ─── Step 2: Real-time listener for services subcollection ───────────────
  useEffect(() => {
    if (!businessId) return;
    if (businessId.startsWith('mock-')) return;
    const servicesRef = collection(db, 'businesses', businessId, 'services');
    const unsub = onSnapshot(
      servicesRef,
      (snap) => {
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        // Sort by name
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setServices(list);
        setLoadingServices(false);
      },
      (err) => {
        console.error('ManageServices: Services listener error', err);
        setLoadingServices(false);
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
    setEditingService(null);
    setFormState({
      name: '',
      description: '',
      durationMinutes: '30',
      price: '0',
      category: 'Salon',
      isActive: true,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // ─── Open Edit Modal ─────────────────────────────────────────────────────
  const handleOpenEdit = (service) => {
    setEditingService(service);
    setFormState({
      name: service.name || '',
      description: service.description || '',
      durationMinutes: String(service.durationMinutes || service.duration || 30),
      price: String(service.price || 0),
      category: service.category || 'Salon',
      isActive: service.isActive !== false,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // ─── Form Submit handler (Add/Edit) ──────────────────────────────────────
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const { name, description, durationMinutes, price, category, isActive } = formState;

    // Validation
    if (!name.trim()) {
      setFormError('Service name is required.');
      return;
    }
    const duration = parseInt(durationMinutes, 10);
    if (isNaN(duration) || duration <= 0) {
      setFormError('Duration must be a positive integer in minutes.');
      return;
    }
    const cost = parseFloat(price);
    if (isNaN(cost) || cost < 0) {
      setFormError('Price must be a valid non-negative number.');
      return;
    }

    setSaving(true);
    try {
      const serviceData = {
        name: name.trim(),
        description: description.trim(),
        durationMinutes: duration,
        price: cost,
        category,
        isActive,
        isAvailable: isActive, // Maintain compatibility
        updatedAt: serverTimestamp(),
      };

      if (editingService) {
        // Edit mode
        const docRef = doc(db, 'businesses', businessId, 'services', editingService.id);
        await updateDoc(docRef, serviceData);
        showToast('Service updated successfully.');
      } else {
        // Add mode
        const colRef = collection(db, 'businesses', businessId, 'services');
        await addDoc(colRef, {
          ...serviceData,
          createdAt: serverTimestamp(),
        });
        showToast('New service added successfully.');
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('ManageServices: Save error', err);
      setFormError(err.message || 'Failed to save service.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle Status Switcher ──────────────────────────────────────────────
  const handleToggleStatus = async (service) => {
    if (!businessId) return;
    const newStatus = service.isActive === false ? true : false;
    try {
      const docRef = doc(db, 'businesses', businessId, 'services', service.id);
      await updateDoc(docRef, {
        isActive: newStatus,
        isAvailable: newStatus,
        updatedAt: serverTimestamp(),
      });
      showToast(`Service marked as ${newStatus ? 'active' : 'inactive'}.`);
    } catch (err) {
      console.error('ManageServices: Toggle status error', err);
      showToast('Failed to toggle active status.', 'error');
    }
  };

  // ─── Delete operations ───────────────────────────────────────────────────
  const handleDeleteTrigger = (id) => {
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!businessId || !deleteConfirmId) return;
    setDeleting(true);
    try {
      const docRef = doc(db, 'businesses', businessId, 'services', deleteConfirmId);
      await deleteDoc(docRef);
      showToast('Service deleted from catalog.');
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('ManageServices: Delete error', err);
      showToast('Failed to delete service.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Derived Filters ─────────────────────────────────────────────────────
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchSearch =
        (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.description || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && s.isActive !== false) ||
        (statusFilter === 'inactive' && s.isActive === false);

      return matchSearch && matchStatus;
    });
  }, [services, searchQuery, statusFilter]);

  // ─── Render States ───────────────────────────────────────────────────────

  // Loading indicator
  if (resolvingBiz || (loadingServices && services.length === 0 && !error)) {
    return (
      <div className="ms-wrapper animate-fade-in">
        <div className="ms-skel-header">
          <Skeleton style={{ width: 100, height: 12 }} />
          <Skeleton style={{ width: 260, height: 32, marginTop: 10 }} />
        </div>
        <div className="ms-skel-bar">
          <Skeleton style={{ width: '40%', height: 42, borderRadius: 8 }} />
          <Skeleton style={{ width: '30%', height: 42, borderRadius: 8 }} />
          <Skeleton style={{ width: 140, height: 42, borderRadius: 24, marginLeft: 'auto' }} />
        </div>
        <div className="ms-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-panel ms-card">
              <Skeleton style={{ width: '70%', height: 20, marginBottom: 8 }} />
              <Skeleton style={{ width: '40%', height: 14, marginBottom: 16 }} />
              <Skeleton style={{ height: 40, marginBottom: 16 }} />
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
      <div className="ms-state-center glass-panel animate-fade-in">
        <AlertTriangle size={44} className="ms-icon-warn" />
        <h2>Catalog Setup Required</h2>
        <p>{error}</p>
        <button className="btn-primary ms-state-btn" onClick={() => window.location.reload()}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {/* ─── TOAST NOTIFICATION ─── */}
      {notification && (
        <div className={`ms-toast ${notification.type} animate-fade-in`}>
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* ─── DELETE CONFIRM MODAL ─── */}
      {deleteConfirmId && (
        <div className="ms-modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="ms-modal delete-modal glass-panel animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="ms-modal-icon danger">
              <AlertTriangle size={24} />
            </div>
            <h3>Delete Service?</h3>
            <p>
              Are you sure you want to delete this service from your catalog? 
              <br />
              <span className="warning-note">
                <strong>Warning:</strong> Existing bookings referencing this service will remain active, but customers won't be able to select it for new appointments. We recommend toggling it to "Inactive" instead.
              </span>
            </p>
            <div className="ms-modal-actions">
              <button className="ms-btn-cancel" onClick={() => setDeleteConfirmId(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="ms-btn-confirm danger" onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? <Loader2 size={14} className="ms-spinner" /> : 'Delete Service'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD / EDIT MODAL ─── */}
      {isModalOpen && (
        <div className="ms-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="ms-modal form-modal glass-panel animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <header className="ms-modal-header">
              <h3>{editingService ? 'Edit Service Details' : 'Add New Service'}</h3>
              <button className="ms-close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </header>

            <form onSubmit={handleFormSubmit} className="ms-form">
              {formError && (
                <div className="ms-form-error">
                  <AlertTriangle size={14} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="ms-form-group">
                <label htmlFor="service-name">Service Name *</label>
                <input
                  id="service-name"
                  type="text"
                  placeholder="e.g. Premium Haircut"
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  required
                />
              </div>

              <div className="ms-form-row">
                <div className="ms-form-group">
                  <label htmlFor="service-price">Price (₹) *</label>
                  <input
                    id="service-price"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={formState.price}
                    onChange={(e) => setFormState({ ...formState, price: e.target.value })}
                    required
                  />
                </div>

                <div className="ms-form-group">
                  <label htmlFor="service-duration">Duration (mins) *</label>
                  <input
                    id="service-duration"
                    type="number"
                    min="1"
                    placeholder="30"
                    value={formState.durationMinutes}
                    onChange={(e) => setFormState({ ...formState, durationMinutes: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="ms-form-row">
                <div className="ms-form-group">
                  <label htmlFor="service-category">Category *</label>
                  <select
                    id="service-category"
                    value={formState.category}
                    onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                  >
                    {COMMON_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="ms-form-group toggle-group">
                  <label>Status</label>
                  <div className="ms-switch-wrapper">
                    <button
                      type="button"
                      className={`ms-custom-switch ${formState.isActive ? 'on' : 'off'}`}
                      onClick={() => setFormState({ ...formState, isActive: !formState.isActive })}
                    >
                      <span className="ms-switch-knob" />
                    </button>
                    <span className="ms-switch-label">
                      {formState.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="ms-form-group">
                <label htmlFor="service-desc">Description</label>
                <textarea
                  id="service-desc"
                  rows="3"
                  placeholder="Describe the service details (e.g. includes wash and styling)..."
                  value={formState.description}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                />
              </div>

              <footer className="ms-form-footer">
                <button
                  type="button"
                  className="ms-btn-cancel"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary ms-btn-save" disabled={saving}>
                  {saving ? <Loader2 size={16} className="ms-spinner" /> : null}
                  <span>{editingService ? 'Save Changes' : 'Create Service'}</span>
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT ─── */}
      <div className="ms-wrapper animate-fade-in">
        {/* Header */}
        <header className="ms-header">
          <div className="ms-header-left">
            <button className="ms-back-btn" onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={15} />
              Dashboard
            </button>
            <span className="ms-eyebrow">Services Manager</span>
            <h1 className="ms-title">{bizName} Catalog</h1>
          </div>
          <button className="btn-primary ms-add-btn" onClick={handleOpenAdd}>
            <Plus size={16} />
            <span>Add Service</span>
          </button>
        </header>

        {/* Toolbar */}
        <div className="ms-toolbar glass-panel">
          <div className="ms-search-wrap">
            <Search size={16} className="ms-search-icon" />
            <input
              type="text"
              placeholder="Search by name, description, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="ms-filters">
            <button
              className={`ms-filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All
            </button>
            <button
              className={`ms-filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              Active
            </button>
            <button
              className={`ms-filter-btn ${statusFilter === 'inactive' ? 'active' : ''}`}
              onClick={() => setStatusFilter('inactive')}
            >
              Inactive
            </button>
          </div>
        </div>

        {/* Services Listing */}
        {filteredServices.length === 0 ? (
          <div className="ms-empty glass-panel">
            <Scissors size={40} className="ms-empty-icon" />
            <h3>No Services Found</h3>
            {services.length === 0 ? (
              <p>Your catalog is currently empty. Get started by adding your first service!</p>
            ) : (
              <p>No services match your active search or status filters.</p>
            )}
            {services.length === 0 && (
              <button className="btn-primary ms-empty-btn" onClick={handleOpenAdd}>
                <Plus size={16} /> Add First Service
              </button>
            )}
          </div>
        ) : (
          <div className="ms-grid">
            {filteredServices.map((service) => {
              const isActive = service.isActive !== false;
              return (
                <div
                  key={service.id}
                  className={`ms-card glass-panel ${!isActive ? 'inactive-card' : ''}`}
                >
                  <div className="ms-card-header">
                    <span className="ms-card-category">{service.category || 'Other'}</span>
                    <div className="ms-card-price">₹{service.price}</div>
                  </div>

                  <h3 className="ms-card-name" title={service.name}>
                    {service.name}
                  </h3>

                  <div className="ms-card-metrics">
                    <Clock size={13} />
                    <span>{service.durationMinutes || service.duration || 0} mins</span>
                  </div>

                  <p className="ms-card-desc">
                    {service.description || 'No description provided.'}
                  </p>

                  <div className="ms-card-footer">
                    <div className="ms-status-toggle">
                      <button
                        className={`ms-mini-switch ${isActive ? 'active' : ''}`}
                        onClick={() => handleToggleStatus(service)}
                        title={isActive ? 'Deactivate service' : 'Activate service'}
                      >
                        <span className="ms-mini-switch-knob" />
                      </button>
                      <span className={`ms-status-label ${isActive ? 'active' : 'inactive'}`}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="ms-card-actions">
                      <button
                        className="ms-action-icon-btn edit"
                        onClick={() => handleOpenEdit(service)}
                        title="Edit service details"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="ms-action-icon-btn delete"
                        onClick={() => handleDeleteTrigger(service.id)}
                        title="Delete service"
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

      {/* Scoped styles for high quality aesthetics */}
      <style>{`
        .ms-wrapper {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 1100px;
          margin: 0 auto;
          padding-bottom: 60px;
        }

        /* ─── Header ──────────────────────────────────────────── */
        .ms-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .ms-header-left {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ms-back-btn {
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

        .ms-back-btn:hover {
          color: var(--primary);
        }

        .ms-eyebrow {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--primary);
        }

        .ms-title {
          font-size: 1.9rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0;
          line-height: 1.15;
        }

        .ms-add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          border-radius: 50px;
          font-size: 0.88rem;
          font-weight: 700;
        }

        /* ─── Toolbar ─────────────────────────────────────────── */
        .ms-toolbar {
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .ms-search-wrap {
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

        .ms-search-wrap:focus-within {
          border-color: rgba(108, 99, 255, 0.45);
          box-shadow: 0 0 10px rgba(108, 99, 255, 0.1);
        }

        .ms-search-icon {
          color: var(--text-secondary);
          flex-shrink: 0;
        }

        .ms-search-wrap input {
          background: none;
          border: none;
          color: var(--text-primary);
          font-size: 0.88rem;
          width: 100%;
          outline: none;
        }

        .ms-search-wrap input::placeholder {
          color: var(--text-secondary);
          opacity: 0.8;
        }

        .ms-filters {
          display: flex;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          padding: 4px;
          border-radius: 50px;
        }

        .ms-filter-btn {
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

        .ms-filter-btn.active {
          background: rgba(108, 99, 255, 0.12);
          color: var(--primary);
        }

        /* ─── Grid & Cards ────────────────────────────────────── */
        .ms-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        .ms-card {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: all 0.25s ease;
          position: relative;
        }

        .ms-card:hover {
          transform: translateY(-3px);
          border-color: rgba(108, 99, 255, 0.28);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
        }

        .ms-card.inactive-card {
          opacity: 0.65;
        }

        .ms-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .ms-card-category {
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--primary);
          background: rgba(108, 99, 255, 0.12);
          border: 1px solid rgba(108, 99, 255, 0.22);
          padding: 2px 8px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .ms-card-price {
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--teal);
        }

        .ms-card-name {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ms-card-metrics {
          display: flex;
          align-items: center;
          gap: 5px;
          color: var(--text-secondary);
          font-size: 0.76rem;
          font-weight: 600;
        }

        .ms-card-desc {
          font-size: 0.82rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          height: 38px;
        }

        .ms-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 6px;
          padding-top: 12px;
          border-top: 1px solid var(--glass-border);
        }

        /* ─── Switch / Toggles ────────────────────────────────── */
        .ms-status-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ms-mini-switch {
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

        .ms-mini-switch.active {
          background: rgba(0, 230, 180, 0.16);
          border-color: rgba(0, 230, 180, 0.4);
        }

        .ms-mini-switch-knob {
          position: absolute;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--text-secondary);
          top: 2px;
          left: 2px;
          transition: transform 0.2s, background-color 0.2s;
        }

        .ms-mini-switch.active .ms-mini-switch-knob {
          transform: translateX(14px);
          background: var(--teal);
        }

        .ms-status-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .ms-status-label.active {
          color: var(--teal);
        }

        .ms-status-label.inactive {
          color: var(--text-secondary);
        }

        .ms-card-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ms-action-icon-btn {
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

        .ms-action-icon-btn:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.08);
        }

        .ms-action-icon-btn.edit:hover {
          border-color: rgba(108, 99, 255, 0.35);
          color: var(--primary);
        }

        .ms-action-icon-btn.delete:hover {
          border-color: rgba(239, 83, 80, 0.35);
          color: #EF5350;
        }

        /* ─── Empty state ──────────────────────────────────────── */
        .ms-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
          padding: 60px 24px;
        }

        .ms-empty-icon {
          color: var(--primary);
          opacity: 0.25;
        }

        .ms-empty h3 {
          font-size: 1.15rem;
          margin: 0;
          color: var(--text-primary);
        }

        .ms-empty p {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0;
          max-width: 360px;
          line-height: 1.5;
        }

        .ms-empty-btn {
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
        .ms-modal-overlay {
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

        .ms-modal {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .ms-modal.delete-modal {
          max-width: 440px;
          padding: 30px;
          text-align: center;
          align-items: center;
        }

        .ms-modal.form-modal {
          max-width: 500px;
          padding: 24px;
        }

        .ms-modal-icon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ms-modal-icon.danger {
          background: rgba(239, 83, 80, 0.12);
          color: #EF5350;
        }

        .ms-modal h3 {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .ms-modal p {
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

        .ms-modal-actions {
          display: flex;
          gap: 10px;
          width: 100%;
          margin-top: 10px;
        }

        /* ─── Forms ────────────────────────────────────────────── */
        .ms-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 14px;
        }

        .ms-close-btn {
          border: none;
          background: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 2px;
          border-radius: 4px;
          transition: background 0.15s;
        }

        .ms-close-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-primary);
        }

        .ms-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .ms-form-error {
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

        .ms-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ms-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        @media (max-width: 480px) {
          .ms-form-row {
            grid-template-columns: 1fr;
          }
        }

        .ms-form-group label {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text-secondary);
        }

        .ms-form-group input,
        .ms-form-group select,
        .ms-form-group textarea {
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

        .ms-form-group input:focus,
        .ms-form-group select:focus,
        .ms-form-group textarea:focus {
          border-color: rgba(108, 99, 255, 0.45);
        }

        .ms-form-group textarea {
          resize: vertical;
        }

        .toggle-group {
          justify-content: flex-end;
          padding-bottom: 2px;
        }

        /* Form Switches */
        .ms-switch-wrapper {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 4px;
          height: 38px;
        }

        .ms-custom-switch {
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

        .ms-custom-switch.on {
          background: rgba(0, 230, 180, 0.16);
          border-color: rgba(0, 230, 180, 0.4);
        }

        .ms-switch-knob {
          position: absolute;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--text-secondary);
          top: 2px;
          left: 2px;
          transition: transform 0.2s, background-color 0.2s;
        }

        .ms-custom-switch.on .ms-switch-knob {
          transform: translateX(22px);
          background: var(--teal);
        }

        .ms-switch-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .ms-form-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          border-top: 1px solid var(--glass-border);
          padding-top: 14px;
          margin-top: 6px;
        }

        /* Buttons */
        .ms-btn-cancel {
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

        .ms-btn-cancel:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary);
        }

        .ms-btn-confirm {
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

        .ms-btn-confirm.danger {
          background: #EF5350;
          box-shadow: 0 4px 12px rgba(239, 83, 80, 0.3);
        }

        .ms-btn-confirm.danger:hover {
          background: #e53935;
        }

        .ms-btn-save {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 9px 20px;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 700;
        }

        /* ─── Toast alerts ─────────────────────────────────────── */
        .ms-toast {
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
          animation: ms-slide-in 0.3s ease;
        }

        @keyframes ms-slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .ms-toast.success {
          background: rgba(76,175,80,0.1);
          border: 1px solid rgba(76,175,80,0.35);
          color: #4CAF50;
          backdrop-filter: blur(8px);
        }

        .ms-toast.error {
          background: rgba(239,83,80,0.1);
          border: 1px solid rgba(239,83,80,0.35);
          color: #EF5350;
          backdrop-filter: blur(8px);
        }

        /* ─── State layouts ───────────────────────────────────── */
        .ms-state-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 60px 32px;
          text-align: center;
          max-width: 460px;
          margin: 60px auto;
        }

        .ms-state-center h2 {
          font-size: 1.3rem;
          color: var(--text-primary);
          margin: 0;
        }

        .ms-state-center p {
          color: var(--text-secondary);
          font-size: 0.88rem;
          margin: 0;
          line-height: 1.5;
        }

        .ms-icon-warn {
          color: #FFC107;
        }

        .ms-state-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          border-radius: 50px;
          font-size: 0.9rem;
          margin-top: 8px;
        }

        /* ─── Skeletons ────────────────────────────────────────── */
        .ms-skeleton {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.04) 25%,
            rgba(255,255,255,0.09) 50%,
            rgba(255,255,255,0.04) 75%
          );
          background-size: 200% 100%;
          animation: ms-shimmer 1.4s ease-in-out infinite;
          border-radius: 4px;
          width: 100%;
          height: 14px;
        }

        @keyframes ms-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .ms-skel-header {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .ms-skel-bar {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: 10px 0;
        }

        .ms-spinner {
          animation: ms-spin 1s linear infinite;
        }

        @keyframes ms-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default ManageServices;
