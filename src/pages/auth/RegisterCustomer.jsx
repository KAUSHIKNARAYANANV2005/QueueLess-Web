import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, Phone, AlertCircle, ArrowRight, Sparkles, ArrowLeft } from 'lucide-react';
import GlassContainer from '../../components/glass/GlassContainer';
import { registerCustomer } from '../../firebase/auth';

const RegisterCustomer = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[^@]+@[^@]+\.[^@]+$/;
    const phoneRegex = /^[0-9]{10}$/;

    if (!name.trim()) {
      newErrors.name = 'Full Name is required.';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters.';
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

    if (!validate()) return;

    setLoading(true);
    try {
      await registerCustomer({ name, email, password, phone });
      // AuthContext listener will automatically handle redirection.
    } catch (err) {
      console.error('Customer registration error:', err);
      setSubmitError(getFriendlyErrorMessage(err.code || err.message));
      setLoading(false);
    }
  };

  return (
    <div className="register-wrapper animate-fade-in">
      <GlassContainer className="register-card">
        {/* Back navigation */}
        <Link to="/login" className="back-link">
          <ArrowLeft size={16} />
          <span>Back to Login</span>
        </Link>

        {/* Header */}
        <div className="register-header">
          <div className="badge-glow">
            <Sparkles size={14} className="sparkle-icon" />
            <span>Join QueueLess</span>
          </div>
          <h2 className="register-title">Customer Sign Up</h2>
          <p className="register-subtitle">Create your account to join live virtual queues and save hours of wait time.</p>
        </div>

        {/* Error Banner */}
        {submitError && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{submitError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="register-form">
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
                disabled={loading}
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
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                maxLength={10}
              />
            </div>
            {errors.phone && <span className="error-text">{errors.phone}</span>}
          </div>

          <div className="form-group">
            <label className="input-label">Password (Min. 6 characters)</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input
                type="password"
                className={`glass-input ${errors.password ? 'input-error' : ''}`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            {errors.password && <span className="error-text">{errors.password}</span>}
          </div>

          <button type="submit" className="btn-primary submit-btn" disabled={loading}>
            <span>{loading ? 'Registering Account...' : 'Create Account'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="register-footer">
          <span>Already have an account? </span>
          <Link to="/login" className="login-link">Sign In</Link>
          <div className="merchant-redirect">
            <span>Are you a business owner? </span>
            <Link to="/register/business" className="business-signup-link">Register Business</Link>
          </div>
        </div>
      </GlassContainer>

      <style>{`
        .register-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 40px 16px;
          min-height: 85vh;
        }

        .register-card {
          width: 100%;
          max-width: 480px;
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
          background: rgba(255, 101, 132, 0.12);
          border: 1px solid rgba(255, 101, 132, 0.2);
          color: var(--coral);
          padding: 4px 12px;
          border-radius: 50px;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.03em;
        }

        .sparkle-icon {
          color: var(--coral);
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

        .glass-input {
          padding-left: 44px;
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
      `}</style>
    </div>
  );
};

export default RegisterCustomer;
