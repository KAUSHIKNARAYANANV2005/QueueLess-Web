import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useBooking } from '../../context/BookingContext';
import {
  ArrowLeft, ArrowRight, Clock, User, Landmark,
  AlertTriangle, RefreshCw, CheckCircle2, Circle
} from 'lucide-react';

const ServiceSelection = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Booking Context
  const {
    businessId,
    selectedService,
    selectedStaff,
    setBusiness,
    setSelectedService,
    setSelectedStaff,
  } = useBooking();

  // Local state for loaded documents
  const [business, setBusinessDoc] = useState(null);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);

  // Loaders
  const [loadingBusiness, setLoadingBusiness] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [error, setError] = useState(null);

  // ── Real-Time Firestore Listeners ──────────────────────────────────────────
  useEffect(() => {
    setLoadingBusiness(true);
    setLoadingServices(true);
    setLoadingStaff(true);
    setError(null);

    // 1. Business Doc Listener
    const businessRef = doc(db, 'businesses', id);
    const unsubBusiness = onSnapshot(
      businessRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const bizData = { id: snapshot.id, ...snapshot.data() };
          setBusinessDoc(bizData);
          // Sync with booking context (sets businessId and businessName)
          setBusiness(bizData.id, bizData.name);
          setError(null);
        } else {
          setError('Business venue not found.');
        }
        setLoadingBusiness(false);
      },
      (err) => {
        console.error('ServiceSelection: Firestore business error', err);
        setError('Failed to load business details.');
        setLoadingBusiness(false);
      }
    );

    // 2. Services List Listener
    const servicesRef = collection(db, 'businesses', id, 'services');
    const unsubServices = onSnapshot(
      servicesRef,
      (snapshot) => {
        const servicesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setServices(servicesList);
        setLoadingServices(false);
      },
      (err) => {
        console.error('ServiceSelection: Firestore services error', err);
        setLoadingServices(false);
      }
    );

    // 3. Staff List Listener
    const staffRef = collection(db, 'businesses', id, 'staff');
    const unsubStaff = onSnapshot(
      staffRef,
      (snapshot) => {
        const staffList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStaff(staffList);
        setLoadingStaff(false);
      },
      (err) => {
        console.error('ServiceSelection: Firestore staff error', err);
        setLoadingStaff(false);
      }
    );

    // Cleanup listeners
    return () => {
      unsubBusiness();
      unsubServices();
      unsubStaff();
    };
  }, [id]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleServiceSelect = (service) => {
    setSelectedService(service);
  };

  const handleStaffSelect = (member) => {
    setSelectedStaff(member);
  };

  const handleContinue = () => {
    if (selectedService) {
      navigate(`/business/${id}/datetime`);
    }
  };

  // Filter only active services and staff
  const activeServices = services.filter(
    (s) => s.isActive !== false && s.isAvailable !== false
  );
  const activeStaff = staff.filter(
    (st) => st.isActive !== false && st.isAvailable !== false
  );

  // ── Render States ──────────────────────────────────────────────────────────

  // Error state
  if (error) {
    return (
      <div className="state-card error-state glass-panel animate-fade-in">
        <AlertTriangle size={48} className="state-icon error-icon" />
        <h2>Selection Unavailable</h2>
        <p>{error}</p>
        <div className="error-actions">
          <button className="btn-glass" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            Go Back
          </button>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isLoading = loadingBusiness || loadingServices || loadingStaff;

  return (
    <div className="selection-wrapper animate-fade-in">
      {/* Header section */}
      <header className="selection-header">
        <button className="back-link-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          <span>Back to Profile</span>
        </button>
        <div className="header-info">
          <span className="step-indicator">Step 1 of 3</span>
          <h1 className="header-title">Configure Appointment</h1>
          {!isLoading && business && <p className="header-subtitle">Booking at <strong>{business.name}</strong></p>}
        </div>
      </header>

      {/* Main configuration grid */}
      <div className="selection-grid">
        {/* Left Column: Services & Staff Selection lists */}
        <main className="selection-main">
          {/* Services list section */}
          <section className="selection-section glass-panel">
            <div className="section-title-row">
              <h2>Select Service</h2>
              <span className="section-subtitle-badge">Select 1 service</span>
            </div>

            {isLoading ? (
              <div className="services-skeleton-list">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="skeleton-item shimmer" />
                ))}
              </div>
            ) : activeServices.length === 0 ? (
              <div className="empty-section-card">
                <p>No active services available at this venue.</p>
              </div>
            ) : (
              <div className="services-list">
                {activeServices.map((service) => {
                  const isSelected = selectedService?.id === service.id;
                  return (
                    <div
                      key={service.id}
                      className={`selectable-card service-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleServiceSelect(service)}
                    >
                      <div className="select-indicator-col">
                        {isSelected ? (
                          <CheckCircle2 size={20} className="indicator-checked" />
                        ) : (
                          <Circle size={20} className="indicator-unchecked" />
                        )}
                      </div>
                      <div className="service-details-col">
                        <div className="service-title-bar">
                          <h3>{service.name}</h3>
                          {service.category && <span className="service-category-tag">{service.category}</span>}
                        </div>
                        {service.description && <p className="service-desc">{service.description}</p>}
                        <div className="service-metrics">
                          <span className="metric-chip">
                            <Clock size={12} />
                            {service.durationMinutes || service.duration || 0} mins
                          </span>
                        </div>
                      </div>
                      <div className="service-price-col">
                        <span className="service-price">₹{service.price}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Staff selection section */}
          <section className="selection-section glass-panel">
            <div className="section-title-row">
              <h2>Select Staff (Optional)</h2>
              <span className="section-subtitle-badge">Any Available Staff matches by default</span>
            </div>

            {isLoading ? (
              <div className="staff-skeleton-list">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="skeleton-staff-chip shimmer" />
                ))}
              </div>
            ) : (
              <div className="staff-selector-grid">
                {/* Default Choice: Any Available Staff */}
                <div
                  className={`selectable-staff-card ${selectedStaff === null ? 'selected' : ''}`}
                  onClick={() => handleStaffSelect(null)}
                >
                  <div className="staff-initials-placeholder default-choice">
                    <User size={18} />
                  </div>
                  <div className="staff-details">
                    <h3>Any Available Staff</h3>
                    <p className="staff-specialty">Matches next free specialist</p>
                  </div>
                </div>

                {/* Active Staff Members */}
                {activeStaff.map((member) => {
                  const isSelected = selectedStaff?.id === member.id;
                  const specialty = member.role || member.specialization || 'Specialist';
                  return (
                    <div
                      key={member.id}
                      className={`selectable-staff-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleStaffSelect(member)}
                    >
                      {member.avatar || member.profileImage ? (
                        <img
                          src={member.avatar || member.profileImage}
                          alt={member.name}
                          className="staff-avatar-img"
                        />
                      ) : (
                        <div className="staff-initials-placeholder">
                          {member.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="staff-details">
                        <h3>{member.name}</h3>
                        <p className="staff-specialty">{specialty}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        {/* Right Column: Booking Summary Sidebar */}
        <aside className="selection-sidebar">
          <div className="summary-sticky-card glass-panel">
            <h2>Booking Summary</h2>

            <div className="summary-rows">
              <div className="summary-item">
                <span className="summary-label">Venue</span>
                <span className="summary-value venue-value">{business?.name || 'Loading venue...'}</span>
              </div>

              <div className="summary-item">
                <span className="summary-label">Service</span>
                <span className={`summary-value ${!selectedService ? 'placeholder-value' : ''}`}>
                  {selectedService ? selectedService.name : 'No service selected'}
                </span>
              </div>

              <div className="summary-item">
                <span className="summary-label">Staff Member</span>
                <span className="summary-value">
                  {selectedStaff ? selectedStaff.name : 'Any Available Staff'}
                </span>
              </div>

              <hr className="summary-divider" />

              <div className="summary-totals">
                <div className="total-row">
                  <span>Duration</span>
                  <span className="total-value">
                    {selectedService ? `${selectedService.durationMinutes || selectedService.duration || 0} mins` : '--'}
                  </span>
                </div>
                <div className="total-row">
                  <span>Total Cost</span>
                  <span className="total-value cost-value">
                    {selectedService ? `₹${selectedService.price}` : '--'}
                  </span>
                </div>
              </div>
            </div>

            <button
              className="btn-primary continue-btn"
              disabled={!selectedService}
              onClick={handleContinue}
            >
              <span>Continue</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </aside>
      </div>

      {/* Scoped Styling */}
      <style>{`
        .selection-wrapper {
          display: flex;
          flex-direction: column;
          gap: 28px;
          max-width: 1200px;
          margin: 0 auto;
          padding-bottom: 48px;
        }

        /* Header Layout */
        .selection-header {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

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

        .header-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .step-indicator {
          font-size: 0.78rem;
          color: var(--primary);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .header-title {
          font-size: 1.8rem;
          color: var(--text-primary);
          margin: 0;
          font-weight: 700;
        }

        .header-subtitle {
          font-size: 0.95rem;
          color: var(--text-secondary);
          margin: 0;
        }

        .header-subtitle strong {
          color: var(--text-primary);
        }

        /* Grid Layout */
        .selection-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 900px) {
          .selection-grid {
            grid-template-columns: 1fr;
          }
        }

        .selection-main {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .selection-section {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .section-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 12px;
        }

        .selection-section h2 {
          font-size: 1.2rem;
          color: var(--text-primary);
          margin: 0;
          font-weight: 600;
        }

        .section-subtitle-badge {
          font-size: 0.75rem;
          color: var(--text-secondary);
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--glass-border);
          padding: 3px 8px;
          border-radius: 12px;
        }

        /* Services Selection */
        .services-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .selectable-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .selectable-card:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(108,99,255,0.3);
        }

        .selectable-card.selected {
          background: rgba(108, 99, 255, 0.06);
          border-color: var(--primary);
          box-shadow: 0 0 16px rgba(108, 99, 255, 0.15);
        }

        .select-indicator-col {
          display: flex;
          align-items: center;
          color: var(--text-secondary);
          flex-shrink: 0;
        }

        .selected .select-indicator-col {
          color: var(--primary);
        }

        .indicator-checked {
          color: var(--primary);
          fill: rgba(108, 99, 255, 0.1);
        }

        .service-details-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .service-title-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .service-title-bar h3 {
          font-size: 0.98rem;
          color: var(--text-primary);
          margin: 0;
          font-weight: 600;
        }

        .service-category-tag {
          font-size: 0.68rem;
          color: var(--primary);
          background: rgba(108, 99, 255, 0.12);
          border: 1px solid rgba(108, 99, 255, 0.2);
          padding: 1px 6px;
          border-radius: 4px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .service-desc {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.4;
          margin: 0;
        }

        .service-metrics {
          display: flex;
          gap: 8px;
        }

        .metric-chip {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .service-price-col {
          flex-shrink: 0;
          text-align: right;
        }

        .service-price {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--teal);
        }

        /* Staff Selector Card List */
        .staff-selector-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px;
        }

        .selectable-staff-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .selectable-staff-card:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(108,99,255,0.3);
        }

        .selectable-staff-card.selected {
          background: rgba(108, 99, 255, 0.06);
          border-color: var(--primary);
          box-shadow: 0 0 12px rgba(108, 99, 255, 0.12);
        }

        .staff-avatar-img {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--glass-border);
        }

        .selected .staff-avatar-img {
          border-color: var(--primary);
        }

        .staff-initials-placeholder {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(108,99,255,0.12);
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          font-weight: 700;
          border: 2px solid var(--glass-border);
        }

        .selected .staff-initials-placeholder {
          border-color: var(--primary);
        }

        .staff-initials-placeholder.default-choice {
          background: rgba(255,255,255,0.06);
          color: var(--text-secondary);
        }

        .selected .staff-initials-placeholder.default-choice {
          background: rgba(108, 99, 255, 0.12);
          color: var(--primary);
        }

        .staff-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .staff-details h3 {
          font-size: 0.85rem;
          color: var(--text-primary);
          margin: 0;
          font-weight: 600;
        }

        .staff-specialty {
          font-size: 0.72rem;
          color: var(--text-secondary);
          margin: 0;
        }

        /* Booking Summary Sidebar Card */
        .summary-sticky-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          position: sticky;
          top: 24px;
        }

        .summary-sticky-card h2 {
          font-size: 1.25rem;
          color: var(--text-primary);
          margin: 0;
          font-weight: 600;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 12px;
        }

        .summary-rows {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .summary-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .summary-value {
          font-size: 0.9rem;
          color: var(--text-primary);
          font-weight: 600;
        }

        .summary-value.venue-value {
          font-size: 0.95rem;
          color: var(--primary);
        }

        .summary-value.placeholder-value {
          color: var(--text-secondary);
          font-weight: 400;
          font-style: italic;
        }

        .summary-divider {
          border: none;
          height: 1px;
          background: var(--glass-border);
          margin: 6px 0;
        }

        .summary-totals {
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: rgba(255,255,255,0.01);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          padding: 12px 16px;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .total-value {
          color: var(--text-primary);
          font-weight: 600;
        }

        .total-value.cost-value {
          color: var(--teal);
          font-size: 1rem;
          font-weight: 700;
        }

        .continue-btn {
          width: 100%;
          padding: 12px;
          border-radius: 50px;
          font-size: 0.9rem;
          font-weight: 600;
          gap: 8px;
          margin-top: 8px;
        }

        /* Skeletons */
        .services-skeleton-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .skeleton-item {
          height: 80px;
          background: rgba(255,255,255,0.02);
          border-radius: var(--border-radius-md);
        }

        .staff-skeleton-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px;
        }

        .skeleton-staff-chip {
          height: 64px;
          background: rgba(255,255,255,0.02);
          border-radius: var(--border-radius-md);
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .shimmer {
          background: linear-gradient(90deg, 
            rgba(255,255,255,0.02) 25%, 
            rgba(255,255,255,0.06) 50%, 
            rgba(255,255,255,0.02) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        .empty-section-card {
          padding: 24px;
          text-align: center;
          border: 1px dashed var(--glass-border);
          border-radius: var(--border-radius-md);
        }

        .empty-section-card p {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0;
        }
      `}</style>
    </div>
  );
};

export default ServiceSelection;
