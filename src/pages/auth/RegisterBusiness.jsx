import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, Phone, AlertCircle, ArrowRight, ArrowLeft, Sparkles, Building, MapPin, AlignLeft, Check } from 'lucide-react';
import GlassContainer from '../../components/glass/GlassContainer';
import { registerBusiness } from '../../firebase/auth';

const CATEGORIES = [
  { value: 'Clinic', label: 'Clinic / Hospital' },
  { value: 'Salon', label: 'Salon / Hairdresser' },
  { value: 'Spa', label: 'Spa / Wellness' },
  { value: 'Bank', label: 'Bank / Financial Hub' },
  { value: 'Government Office', label: 'Government Office' }
];

const RegisterBusiness = () => {
  const navigate = useNavigate();
  
  // Step State (1: Owner Info, 2: Business Info)
  const [step, setStep] = useState(1);

  // Form Fields
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const validateStep1 = () => {
    const newErrors = {};
    const emailRegex = /^[^@]+@[^@]+\.[^@]+$/;
    const phoneRegex = /^[0-9]{10}$/;

    if (!ownerName.trim()) {
      newErrors.ownerName = 'Full Name is required.';
    } else if (ownerName.trim().length < 2) {
      newErrors.ownerName = 'Name must be at least 2 characters.';
    }

    if (!email) {
      newErrors.email = 'Email address is required.';
    } else if (!emailRegex.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required.';
    } else if (!phoneRegex.test(phone.trim())) {
      newErrors.phone = 'Please enter a valid 10-digit phone number.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    const phoneRegex = /^[0-9]{10}$/;

    if (!businessName.trim()) {
      newErrors.businessName = 'Business Name is required.';
    }

    if (!category) {
      newErrors.category = 'Business Category is required.';
    }

    if (!description.trim()) {
      newErrors.description = 'Brief description is required.';
    }

    if (!address.trim()) {
      newErrors.address = 'Storefront address is required.';
    }

    if (!businessPhone.trim()) {
      newErrors.businessPhone = 'Business Phone is required.';
    } else if (!phoneRegex.test(businessPhone.trim())) {
      newErrors.businessPhone = 'Please enter a valid 10-digit phone number.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const getFriendlyErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'The email address is badly formatted.';
      case 'auth/email-already-in-use':
        return 'This email address is already registered.';
      case 'auth/weak-password':
        return 'The password is too weak. Must be at least 6 characters.';
      default:
        return 'An unexpected registration error occurred. Please try again.';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!validateStep2()) return;

    setLoading(true);
    try {
      await registerBusiness({
        ownerName,
        email,
        password,
        phone,
        businessName,
        category,
        description,
        address,
        businessPhone
      });
      // AuthContext listener will automatically handle redirection.
    } catch (err) {
      console.error('Business registration error:', err);
      setSubmitError(getFriendlyErrorMessage(err.code || err.message));
      setLoading(false);
    }
  };

  return (
    <div className="register-wrapper animate-fade-in">
      <GlassContainer className="register-card">
        {/* Back navigation */}
        {step === 1 ? (
          <Link to="/login" className="back-link">
            <ArrowLeft size={16} />
            <span>Back to Login</span>
          </Link>
        ) : (
          <button type="button" className="back-link" onClick={handleBack} disabled={loading}>
            <ArrowLeft size={16} />
            <span>Back to Owner Details</span>
          </button>
        )}

        {/* Header */}
        <div className="register-header">
          <div className="badge-glow">
            <Sparkles size={14} className="sparkle-icon" />
            <span>AntiGravity Merchant Portal</span>
          </div>
          <h2 className="register-title">Register Business</h2>
          <p className="register-subtitle">
            {step === 1 
              ? 'Step 1: Set up your merchant account credentials.' 
              : 'Step 2: Tell us about your storefront to build your queue.'}
          </p>
        </div>

        {/* Progress Tracker */}
        <div className="step-tracker">
          <div className={`step-node ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
            <div className="step-circle">{step > 1 ? <Check size={14} /> : '1'}</div>
            <span>Owner</span>
          </div>
          <div className="step-line-container">
            <div className={`step-line ${step > 1 ? 'filled' : ''}`} />
          </div>
          <div className={`step-node ${step >= 2 ? 'active' : ''}`}>
            <div className="step-circle">2</div>
            <span>Business</span>
          </div>
        </div>

        {/* Error Banner */}
        {submitError && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{submitError}</span>
          </div>
        )}

        {/* Step 1 Form (Owner Info) */}
        {step === 1 && (
          <div className="step-content animate-fade-in">
            <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="register-form">
              <div className="form-group">
                <label className="input-label">Owner Full Name</label>
                <div className="input-wrapper">
                  <User className="input-icon" size={18} />
                  <input
                    type="text"
                    className={`glass-input ${errors.ownerName ? 'input-error' : ''}`}
                    placeholder="Jane Smith"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>
                {errors.ownerName && <span className="error-text">{errors.ownerName}</span>}
              </div>

              <div className="form-group">
                <label className="input-label">Login Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={18} />
                  <input
                    type="email"
                    className={`glass-input ${errors.email ? 'input-error' : ''}`}
                    placeholder="jane@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {errors.email && <span className="error-text">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label className="input-label">Personal Phone Number</label>
                <div className="input-wrapper">
                  <Phone className="input-icon" size={18} />
                  <input
                    type="tel"
                    className={`glass-input ${errors.phone ? 'input-error' : ''}`}
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={10}
                  />
                </div>
                {errors.phone && <span className="error-text">{errors.phone}</span>}
              </div>

              <div className="form-group">
                <label className="input-label">Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    type="password"
                    className={`glass-input ${errors.password ? 'input-error' : ''}`}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {errors.password && <span className="error-text">{errors.password}</span>}
              </div>

              <button type="submit" className="btn-primary submit-btn">
                <span>Continue to Business Details</span>
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        )}

        {/* Step 2 Form (Business Info) */}
        {step === 2 && (
          <div className="step-content animate-fade-in">
            <form onSubmit={handleSubmit} className="register-form">
              <div className="form-group">
                <label className="input-label">Business / Shop Name</label>
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
                <label className="input-label">Storefront Address</label>
                <div className="input-wrapper">
                  <MapPin className="input-icon" size={18} />
                  <input
                    type="text"
                    className={`glass-input ${errors.address ? 'input-error' : ''}`}
                    placeholder="123 Main St, New Delhi, India"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={loading}
                  />
                </div>
                {errors.address && <span className="error-text">{errors.address}</span>}
              </div>

              <div className="form-group">
                <label className="input-label">Business Phone Number</label>
                <div className="input-wrapper">
                  <Phone className="input-icon" size={18} />
                  <input
                    type="tel"
                    className={`glass-input ${errors.businessPhone ? 'input-error' : ''}`}
                    placeholder="9876543210"
                    value={businessPhone}
                    onChange={(e) => setBusinessPhone(e.target.value)}
                    disabled={loading}
                    maxLength={10}
                  />
                </div>
                {errors.businessPhone && <span className="error-text">{errors.businessPhone}</span>}
              </div>

              <div className="form-group">
                <label className="input-label">Short Description</label>
                <div className="input-wrapper">
                  <AlignLeft className="input-icon textarea-icon" size={18} />
                  <textarea
                    className={`glass-input glass-textarea ${errors.description ? 'input-error' : ''}`}
                    placeholder="Describe your services, working hours, or specializations..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={loading}
                    rows={3}
                  />
                </div>
                {errors.description && <span className="error-text">{errors.description}</span>}
              </div>

              <button type="submit" className="btn-primary submit-btn" disabled={loading}>
                <span>{loading ? 'Setting up storefront...' : 'Register & Create Store'}</span>
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        )}

        <div className="register-footer">
          <span>Already have an account? </span>
          <Link to="/login" className="login-link">Sign In</Link>
          <div className="merchant-redirect">
            <span>Registering for personal use? </span>
            <Link to="/register/customer" className="business-signup-link">Customer Registration</Link>
          </div>
        </div>
      </GlassContainer>

      <style>{`
        .register-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 40px 16px;
          min-height: 90vh;
        }

        .register-card {
          width: 100%;
          max-width: 520px;
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

        .register-header {
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

        .register-title {
          font-size: 2rem;
          color: var(--text-primary);
        }

        .register-subtitle {
          color: var(--text-secondary);
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .step-tracker {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          margin: 8px 0;
        }

        .step-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary);
          width: 60px;
        }

        .step-node.active {
          color: var(--primary);
        }

        .step-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--glass-bg);
          border: 1.5px solid var(--glass-border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: var(--text-secondary);
          transition: all 0.3s ease;
        }

        .step-node.active .step-circle {
          border-color: var(--primary);
          background: rgba(108, 99, 255, 0.1);
          color: var(--primary);
        }

        .step-node.completed .step-circle {
          background: var(--primary);
          border-color: var(--primary);
          color: #FFFFFF;
        }

        .step-line-container {
          flex: 1;
          height: 2px;
          background: var(--glass-border);
          margin: 0 12px;
          position: relative;
          transform: translateY(-10px);
        }

        .step-line {
          height: 100%;
          width: 0%;
          background: var(--primary);
          transition: width 0.3s ease;
        }

        .step-line.filled {
          width: 100%;
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

        .register-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-align: left;
        }

        .input-label {
          font-size: 0.85rem;
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
          font-size: 0.78rem;
          color: var(--coral);
          font-weight: 500;
        }

        .submit-btn {
          width: 100%;
          margin-top: 8px;
        }

        .register-footer {
          display: flex;
          flex-direction: column;
          gap: 12px;
          font-size: 0.88rem;
          color: var(--text-secondary);
          text-align: center;
        }

        .login-link, .business-signup-link {
          font-weight: 600;
        }

        .merchant-redirect {
          margin-top: 8px;
          padding-top: 12px;
          border-top: 1px solid var(--glass-border);
          font-size: 0.8rem;
        }

        /* Styles for drop down options in dark mode */
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

export default RegisterBusiness;
