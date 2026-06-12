import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, AlertCircle, ArrowRight, Sparkles, User, Briefcase, Phone } from 'lucide-react';
import GlassContainer from '../../components/glass/GlassContainer';
import { loginWithEmail, loginWithGoogle } from '../../firebase/auth';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleGoogleLogin = async () => {
    setSubmitError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      // AuthContext listener will automatically handle redirection.
    } catch (err) {
      console.error('Google Sign-In error:', err);
      setSubmitError(getFriendlyErrorMessage(err.code || err.message));
      setLoading(false);
    }
  };

  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[^@]+@[^@]+\.[^@]+$/;

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getFriendlyErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'The email address is badly formatted.';
      case 'auth/user-disabled':
        return 'This user account has been disabled.';
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/email-already-in-use':
        return 'This email address is already registered.';
      case 'auth/weak-password':
        return 'The password is too weak. Must be at least 6 characters.';
      case 'auth/invalid-credential':
        return 'Incorrect email or password.';
      case 'auth/too-many-requests':
        return 'Too many failed login attempts. Please try again later.';
      default:
        return 'An unexpected authentication error occurred. Please try again.';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    
    if (!validate()) return;

    setLoading(true);
    try {
      await loginWithEmail(email, password);
      // AuthContext listener will automatically handle redirection.
    } catch (err) {
      console.error('Login error:', err);
      setSubmitError(getFriendlyErrorMessage(err.code));
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper animate-fade-in">
      <GlassContainer className="login-card">
        {/* Header */}
        <div className="login-header">
          <div className="badge-glow">
            <Sparkles size={14} className="sparkle-icon" />
            <span>QueueLess Portal</span>
          </div>
          <h2 className="login-title">Welcome Back</h2>
          <p className="login-subtitle">Sign in to manage your bookings and virtual queues.</p>
        </div>

        {/* Error Banner */}
        {submitError && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{submitError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="input-label">Email Address</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={18} />
              <input
                type="email"
                className={`glass-input ${errors.email ? 'input-error' : ''}`}
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          <div className="form-group">
            <div className="label-row">
              <label className="input-label">Password</label>
              <Link to="/forgot-password" className="forgot-password-link">
                Forgot Password?
              </Link>
            </div>
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
            <span>{loading ? 'Signing In...' : 'Sign In'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="social-login-separator">
          <span>Or continue with</span>
        </div>

        <div className="social-login-actions">
          <button type="button" className="btn-glass google-btn" onClick={handleGoogleLogin} disabled={loading}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Google</span>
          </button>
          <Link to="/phone-login" className="btn-glass phone-btn">
            <Phone size={16} />
            <span>SMS OTP</span>
          </Link>
        </div>

        <div className="divider">
          <span>Or sign up as</span>
        </div>

        <div className="register-options">
          <Link to="/register/customer" className="register-option btn-glass">
            <User size={18} className="option-icon coral" />
            <div className="option-text">
              <h4>Customer Account</h4>
              <p>Book salons, clinics, banks</p>
            </div>
          </Link>
          <Link to="/register/business" className="register-option btn-glass">
            <Briefcase size={18} className="option-icon purple" />
            <div className="option-text">
              <h4>Merchant Portal</h4>
              <p>Manage queues & services</p>
            </div>
          </Link>
        </div>
      </GlassContainer>

      <style>{`
        .login-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 40px 16px;
          min-height: 80vh;
        }

        .login-card {
          width: 100%;
          max-width: 480px;
          padding: 40px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .login-header {
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

        .login-title {
          font-size: 2rem;
          color: var(--text-primary);
        }

        .login-subtitle {
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

        .login-form {
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

        .label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .input-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .forgot-password-link {
          font-size: 0.8rem;
          font-weight: 600;
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

        .divider {
          display: flex;
          align-items: center;
          text-align: center;
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 500;
        }

        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid var(--glass-border);
        }

        .divider:not(:empty)::before {
          margin-right: .75em;
        }

        .divider:not(:empty)::after {
          margin-left: .75em;
        }

        .register-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .register-option {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 14px 20px;
          text-align: left;
          width: 100%;
          box-sizing: border-box;
          border-radius: var(--border-radius-md);
        }

        .option-icon {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .option-icon.coral {
          background: rgba(255, 101, 132, 0.1);
          color: var(--coral);
        }

        .option-icon.purple {
          background: rgba(108, 99, 255, 0.1);
          color: var(--primary);
        }

        .option-text h4 {
          font-size: 0.95rem;
          color: var(--text-primary);
          margin-bottom: 2px;
        }

        .option-text p {
          font-size: 0.78rem;
          color: var(--text-secondary);
          margin: 0;
        }

        .social-login-separator {
          display: flex;
          align-items: center;
          text-align: center;
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 500;
          margin: 4px 0;
        }

        .social-login-separator::before,
        .social-login-separator::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid var(--glass-border);
        }

        .social-login-separator:not(:empty)::before {
          margin-right: .75em;
        }

        .social-login-separator:not(:empty)::after {
          margin-left: .75em;
        }

        .social-login-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .google-btn, .phone-btn {
          font-size: 0.85rem;
          padding: 10px 14px;
          gap: 8px;
          white-space: nowrap;
        }

        @media (max-width: 400px) {
          .social-login-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default Login;
