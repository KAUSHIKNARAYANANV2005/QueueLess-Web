import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, AlertCircle, ArrowLeft, CheckCircle, Sparkles } from 'lucide-react';
import GlassContainer from '../../components/glass/GlassContainer';
import { sendPasswordReset } from '../../firebase/auth';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const emailRegex = /^[^@]+@[^@]+\.[^@]+$/;
    if (!email) {
      setError('Email address is required.');
      return false;
    } else if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return false;
    }
    setError('');
    return true;
  };

  const getFriendlyErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'The email address is badly formatted.';
      case 'auth/user-not-found':
        return 'No user found with this email address.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess(false);
    setError('');

    if (!validate()) return;

    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSuccess(true);
      setEmail('');
    } catch (err) {
      console.error('Password reset error:', err);
      setError(getFriendlyErrorMessage(err.code || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-wrapper animate-fade-in">
      <GlassContainer className="forgot-password-card">
        {/* Back navigation */}
        <Link to="/login" className="back-link">
          <ArrowLeft size={16} />
          <span>Back to Login</span>
        </Link>

        {/* Header */}
        <div className="forgot-password-header">
          <div className="badge-glow">
            <Sparkles size={14} className="sparkle-icon" />
            <span>Reset Account</span>
          </div>
          <h2 className="forgot-password-title">Recover Password</h2>
          <p className="forgot-password-subtitle">
            Enter your email below and we'll send you a link to reset your password.
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Success Card */}
        {success && (
          <div className="success-banner">
            <CheckCircle size={18} />
            <span>A password reset email has been successfully sent! Check your inbox.</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="forgot-password-form">
          <div className="form-group">
            <label className="input-label">Email Address</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={18} />
              <input
                type="email"
                className={`glass-input ${error ? 'input-error' : ''}`}
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary submit-btn" disabled={loading}>
            <span>{loading ? 'Sending Link...' : 'Send Recovery Link'}</span>
          </button>
        </form>

        <div className="forgot-password-footer">
          <span>Remembered password? </span>
          <Link to="/login" className="login-link">Sign In</Link>
        </div>
      </GlassContainer>

      <style>{`
        .forgot-password-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 40px 16px;
          min-height: 75vh;
        }

        .forgot-password-card {
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

        .forgot-password-header {
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

        .forgot-password-title {
          font-size: 2rem;
          color: var(--text-primary);
        }

        .forgot-password-subtitle {
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

        .success-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          background: rgba(0, 245, 212, 0.08);
          border: 1px solid rgba(0, 245, 212, 0.2);
          color: #00BFA5;
          border-radius: var(--border-radius-sm);
          font-size: 0.95rem;
          text-align: left;
          font-weight: 500;
          line-height: 1.4;
        }

        .forgot-password-form {
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

        .submit-btn {
          width: 100%;
          margin-top: 8px;
          display: flex;
          justify-content: center;
        }

        .forgot-password-footer {
          font-size: 0.88rem;
          color: var(--text-secondary);
          text-align: center;
        }

        .login-link {
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

export default ForgotPassword;
