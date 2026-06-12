import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { ROLE_HOME } from '../../context/AuthContext';
import GlassContainer from '../../components/glass/GlassContainer';
import { completeCustomerProfile, completeBusinessProfile } from '../../firebase/auth';
import { Sparkles, User, Briefcase, Mail, Lock, Phone, AlertCircle, ArrowRight, ArrowLeft, Building, MapPin, AlignLeft } from 'lucide-react';

const CATEGORIES = [
  { value: 'Clinic', label: 'Clinic / Hospital' },
  { value: 'Salon', label: 'Salon / Hairdresser' },
  { value: 'Spa', label: 'Spa / Wellness' },
  { value: 'Bank', label: 'Bank / Financial Hub' },
  { value: 'Government Office', label: 'Government Office' }
];

const RoleSelection = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, role, isAuthenticated, loading: authLoading } = useAuth();

  // Selected Pipeline ('customer' or 'business' or null)
  const [selectedRole, setSelectedRole] = useState(null);

  // Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Business States
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');

  // UI States
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Populate fields from Firebase currentUser session on load
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.displayName || '');
      setEmail(currentUser.email || '');
      
      let rawPhone = currentUser.phoneNumber || '';
      if (rawPhone.startsWith('+91')) {
        rawPhone = rawPhone.substring(3);
      }
      setPhone(rawPhone);
    }
  }, [currentUser]);

  // If AuthContext is still loading, wait
  if (authLoading) {
    return null; // Route protection loading screen will display
  }

  // If not logged in, bounce to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If already has a role, redirect to their home
  if (role) {
    const destination = ROLE_HOME[role] ?? '/home';
    return <Navigate to={destination} replace />;
  }

  const validateCustomer = () => {
    const newErrors = {};
    const emailRegex = /^[^@]+@[^@]+\.[^@]+$/;
    const phoneRegex = /^[0-9]{10}$/;

    if (!name.trim()) {
      newErrors.name = 'Full Name is required.';
    }

    if (!email) {
      newErrors.email = 'Email address is required.';
    } else if (!emailRegex.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required.';
    } else if (!phoneRegex.test(phone.trim())) {
      newErrors.phone = 'Please enter a valid 10-digit phone number.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateBusiness = () => {
    const newErrors = {};
    const emailRegex = /^[^@]+@[^@]+\.[^@]+$/;
    const phoneRegex = /^[0-9]{10}$/;

    if (!name.trim()) {
      newErrors.name = 'Owner Name is required.';
    }

    if (!email) {
      newErrors.email = 'Owner Email is required.';
    } else if (!emailRegex.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Owner Phone is required.';
    } else if (!phoneRegex.test(phone.trim())) {
      newErrors.phone = 'Please enter a valid 10-digit phone number.';
    }

    if (!businessName.trim()) {
      newErrors.businessName = 'Business Name is required.';
    }

    if (!category) {
      newErrors.category = 'Business Category is required.';
    }

    if (!address.trim()) {
      newErrors.address = 'Storefront Address is required.';
    }

    if (!businessPhone.trim()) {
      newErrors.businessPhone = 'Business Phone is required.';
    } else if (!phoneRegex.test(businessPhone.trim())) {
      newErrors.businessPhone = 'Please enter a valid 10-digit phone number.';
    }

    if (!description.trim()) {
      newErrors.description = 'Short description is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!validateCustomer()) return;

    setLoading(true);
    try {
      await completeCustomerProfile(currentUser.uid, { name, email, phone });
      // Immediately navigate — AuthContext onSnapshot will sync in the background
      navigate('/home', { replace: true });
    } catch (err) {
      console.error('Complete Customer Profile Error:', err);
      setSubmitError('Failed to complete customer registration. Please try again.');
      setLoading(false);
    }
  };

  const handleBusinessSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!validateBusiness()) return;

    setLoading(true);
    try {
      await completeBusinessProfile(currentUser.uid, {
        ownerName: name,
        email,
        phone,
        businessName,
        category,
        description,
        address,
        businessPhone
      });
      // Immediately navigate — AuthContext onSnapshot will sync in the background
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Complete Business Profile Error:', err);
      setSubmitError('Failed to complete merchant registration. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="role-selection-wrapper animate-fade-in">
      <GlassContainer className="role-selection-card">
        {selectedRole && (
          <button type="button" className="back-link" onClick={() => { setSelectedRole(null); setErrors({}); setSubmitError(''); }} disabled={loading}>
            <ArrowLeft size={16} />
            <span>Change Portal Type</span>
          </button>
        )}

        {/* Header */}
        <div className="role-header">
          <div className="badge-glow">
            <Sparkles size={14} className="sparkle-icon" />
            <span>Profile Completion</span>
          </div>
          <h2 className="role-title">Almost There</h2>
          <p className="role-subtitle">
            {!selectedRole 
              ? 'Complete your profile details. Which portal fits you best?'
              : selectedRole === 'customer'
                ? 'Complete your personal details to begin booking.'
                : 'Setup your storefront options to begin hosting queues.'}
          </p>
        </div>

        {/* Error Banner */}
        {submitError && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{submitError}</span>
          </div>
        )}

        {/* 1. Selector Stage */}
        {!selectedRole && (
          <div className="options-stage animate-fade-in">
            <div className="portal-options">
              <button 
                type="button" 
                className="portal-choice-card btn-glass"
                onClick={() => setSelectedRole('customer')}
              >
                <div className="icon-badge customer-accent">
                  <User size={24} />
                </div>
                <div className="choice-text">
                  <h3>Customer Account</h3>
                  <p>Book queues at clinics, salons, spas, banks, and more. Track wait times in real-time.</p>
                </div>
                <ArrowRight size={18} className="arrow-next" />
              </button>

              <button 
                type="button" 
                className="portal-choice-card btn-glass"
                onClick={() => setSelectedRole('business')}
              >
                <div className="icon-badge business-accent">
                  <Briefcase size={24} />
                </div>
                <div className="choice-text">
                  <h3>Merchant Portal</h3>
                  <p>Create lists of services & staff, host active queues, and serve customers with virtual tickets.</p>
                </div>
                <ArrowRight size={18} className="arrow-next" />
              </button>
            </div>
          </div>
        )}

        {/* 2. Customer Form Stage */}
        {selectedRole === 'customer' && (
          <div className="form-stage animate-fade-in">
            <form onSubmit={handleCustomerSubmit} className="completion-form">
              <div className="form-group">
                <label className="input-label">Full Name</label>
                <div className="input-wrapper">
                  <User className="input-icon" size={18} />
                  <input
                    type="text"
                    className={`glass-input ${errors.name ? 'input-error' : ''}`}
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                {errors.name && <span className="error-text">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label className="input-label">Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={18} />
                  <input
                    type="email"
                    className={`glass-input ${errors.email ? 'input-error' : ''}`}
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading || !!currentUser?.email}
                  />
                </div>
                {errors.email && <span className="error-text">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label className="input-label">Phone Number (10 Digits)</label>
                <div className="input-wrapper">
                  <Phone className="input-icon" size={18} />
                  <input
                    type="tel"
                    className={`glass-input ${errors.phone ? 'input-error' : ''}`}
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    disabled={loading || !!currentUser?.phoneNumber}
                    maxLength={10}
                  />
                </div>
                {errors.phone && <span className="error-text">{errors.phone}</span>}
              </div>

              <button type="submit" className="btn-primary submit-btn" disabled={loading}>
                <span>{loading ? 'Completing Profile...' : 'Complete Profile'}</span>
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        )}

        {/* 3. Business Form Stage */}
        {selectedRole === 'business' && (
          <div className="form-stage animate-fade-in">
            <form onSubmit={handleBusinessSubmit} className="completion-form">
              <div className="section-title">Owner Details</div>
              
              <div className="form-group">
                <label className="input-label">Owner Full Name</label>
                <div className="input-wrapper">
                  <User className="input-icon" size={18} />
                  <input
                    type="text"
                    className={`glass-input ${errors.name ? 'input-error' : ''}`}
                    placeholder="Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                {errors.name && <span className="error-text">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label className="input-label">Login Email</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={18} />
                  <input
                    type="email"
                    className={`glass-input ${errors.email ? 'input-error' : ''}`}
                    placeholder="jane@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading || !!currentUser?.email}
                  />
                </div>
                {errors.email && <span className="error-text">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label className="input-label">Owner Phone</label>
                <div className="input-wrapper">
                  <Phone className="input-icon" size={18} />
                  <input
                    type="tel"
                    className={`glass-input ${errors.phone ? 'input-error' : ''}`}
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    disabled={loading || !!currentUser?.phoneNumber}
                    maxLength={10}
                  />
                </div>
                {errors.phone && <span className="error-text">{errors.phone}</span>}
              </div>

              <div className="section-title margin-top">Store Details</div>

              <div className="form-group">
                <label className="input-label">Business Name</label>
                <div className="input-wrapper">
                  <Building className="input-icon" size={18} />
                  <input
                    type="text"
                    className={`glass-input ${errors.businessName ? 'input-error' : ''}`}
                    placeholder="Apex Health Clinic"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                {errors.businessName && <span className="error-text">{errors.businessName}</span>}
              </div>

              <div className="form-group">
                <label className="input-label">Category</label>
                <div className="input-wrapper">
                  <select
                    className={`glass-input glass-select ${errors.category ? 'input-error' : ''}`}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={loading}
                  >
                    <option value="" disabled>Select Business Category</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                {errors.category && <span className="error-text">{errors.category}</span>}
              </div>

              <div className="form-group">
                <label className="input-label">Address</label>
                <div className="input-wrapper">
                  <MapPin className="input-icon" size={18} />
                  <input
                    type="text"
                    className={`glass-input ${errors.address ? 'input-error' : ''}`}
                    placeholder="123 Main St, New Delhi"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={loading}
                  />
                </div>
                {errors.address && <span className="error-text">{errors.address}</span>}
              </div>

              <div className="form-group">
                <label className="input-label">Business Phone</label>
                <div className="input-wrapper">
                  <Phone className="input-icon" size={18} />
                  <input
                    type="tel"
                    className={`glass-input ${errors.businessPhone ? 'input-error' : ''}`}
                    placeholder="9876543210"
                    value={businessPhone}
                    onChange={(e) => setBusinessPhone(e.target.value.replace(/\D/g, ''))}
                    disabled={loading}
                    maxLength={10}
                  />
                </div>
                {errors.businessPhone && <span className="error-text">{errors.businessPhone}</span>}
              </div>

              <div className="form-group">
                <label className="input-label">Description</label>
                <div className="input-wrapper">
                  <AlignLeft className="input-icon textarea-icon" size={18} />
                  <textarea
                    className={`glass-input glass-textarea ${errors.description ? 'input-error' : ''}`}
                    placeholder="Describe your services and specializations..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={loading}
                    rows={3}
                  />
                </div>
                {errors.description && <span className="error-text">{errors.description}</span>}
              </div>

              <button type="submit" className="btn-primary submit-btn" disabled={loading}>
                <span>{loading ? 'Registering Storefront...' : 'Complete & Setup Store'}</span>
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        )}
      </GlassContainer>

      <style>{`
        .role-selection-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 40px 16px;
          min-height: 80vh;
        }

        .role-selection-card {
          width: 100%;
          max-width: 540px;
          padding: 40px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .back-link {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
          align-self: flex-start;
          transition: color 0.2s ease;
          border: none;
          background: none;
          padding: 0;
          cursor: pointer;
        }

        .back-link:hover {
          color: var(--primary);
        }

        .role-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
        }

        .badge-glow {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(108, 99, 255, 0.12);
          border: 1px solid rgba(108, 99, 255, 0.2);
          color: var(--primary);
          padding: 4px 12px;
          border-radius: 50px;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.03em;
        }

        .sparkle-icon {
          color: var(--primary);
        }

        .role-title {
          font-size: 2rem;
          color: var(--text-primary);
        }

        .role-subtitle {
          color: var(--text-secondary);
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .portal-options {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
        }

        .portal-choice-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 24px;
          border-radius: var(--border-radius-md);
          width: 100%;
          box-sizing: border-box;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .portal-choice-card:hover {
          transform: translateY(-2px);
        }

        .icon-badge {
          width: 48px;
          height: 48px;
          border-radius: var(--border-radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          flex-shrink: 0;
        }

        .customer-accent {
          background: linear-gradient(135deg, #FF6584 0%, #FF3366 100%);
          box-shadow: 0 4px 10px rgba(255, 101, 132, 0.25);
        }

        .business-accent {
          background: linear-gradient(135deg, #6C63FF 0%, #4E44E7 100%);
          box-shadow: 0 4px 10px rgba(108, 99, 255, 0.25);
        }

        .choice-text {
          flex: 1;
        }

        .choice-text h3 {
          font-size: 1.15rem;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .choice-text p {
          font-size: 0.8rem;
          color: var(--text-secondary);
          line-height: 1.4;
          margin: 0;
        }

        .arrow-next {
          color: var(--text-secondary);
        }

        .completion-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .section-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--primary);
          text-align: left;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--glass-border);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .section-title.margin-top {
          margin-top: 12px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          text-align: left;
        }

        .input-label {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          color: var(--text-secondary);
          pointer-events: none;
        }

        .textarea-icon {
          top: 14px;
        }

        .glass-input {
          padding-left: 44px;
        }

        .glass-select {
          appearance: none;
          cursor: pointer;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%235F597D' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>");
          background-repeat: no-repeat;
          background-position: right 14px center;
          background-size: 16px;
          padding-right: 44px;
        }

        [data-theme='dark'] .glass-select {
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23A5A0C5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>");
        }

        .glass-textarea {
          resize: none;
          font-family: inherit;
        }

        .input-error {
          border-color: rgba(255, 101, 132, 0.5);
        }

        .input-error:focus {
          border-color: var(--coral);
          box-shadow: 0 0 0 3px rgba(255, 101, 132, 0.15);
        }

        .error-text {
          font-size: 0.76rem;
          color: var(--coral);
          font-weight: 500;
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(255, 101, 132, 0.08);
          border: 1px solid rgba(255, 101, 132, 0.2);
          color: #E63956;
          border-radius: var(--border-radius-sm);
          font-size: 0.9rem;
          text-align: left;
        }

        .submit-btn {
          width: 100%;
          margin-top: 8px;
        }

        select option {
          background-color: #0A0915;
          color: #F3F1FD;
        }
        
        [data-theme='light'] select option {
          background-color: #FFFFFF;
          color: #1E1A34;
        }
      `}</style>
    </div>
  );
};

export default RoleSelection;
