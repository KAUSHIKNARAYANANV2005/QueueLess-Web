import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Lock, AlertCircle, ArrowLeft, ArrowRight, Sparkles, CheckCircle } from 'lucide-react';
import GlassContainer from '../../components/glass/GlassContainer';

const OtpVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Extract phone number passed from PhoneLogin page
  const phoneNumber = location.state?.phoneNumber || '';

  useEffect(() => {
    // If confirmationResult does not exist in window, user shouldn't be here
    if (!window.confirmationResult) {
      console.warn('No active OTP session detected. Redirecting to phone login...');
      navigate('/phone-login', { replace: true });
    }
  }, [navigate]);

  const validate = () => {
    const codeRegex = /^[0-9]{6}$/;
    if (!otpCode.trim()) {
      setError('Verification code is required.');
      return false;
    } else if (!codeRegex.test(otpCode.trim())) {
      setError('Please enter a valid 6-digit verification code.');
      return false;
    }
    setError('');
    return true;
  };

  const getFriendlyErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/invalid-verification-code':
        return 'The verification code entered is incorrect. Please check and try again.';
      case 'auth/code-expired':
        return 'This verification code has expired. Please go back and request a new one.';
      case 'auth/session-expired':
        return 'The authentication session has expired. Please go back and resend the code.';
      default:
        return 'Failed to verify verification code. Please try again.';
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setLoading(true);

    try {
      const confirmationResult = window.confirmationResult;
      
      if (!confirmationResult) {
        throw new Error('auth/session-expired');
      }

      await confirmationResult.confirm(otpCode.trim());
      
      // Cleanup session variable on success
      window.confirmationResult = null;
      
      // Redirection is handled automatically by route guards via AuthContext!
    } catch (err) {
      console.error('OTP confirmation error:', err);
      setError(getFriendlyErrorMessage(err.code || err.message));
      setLoading(false);
    }
  };

  return (
    <div className="otp-wrapper animate-fade-in">
      <GlassContainer className="otp-card">
        {/* Back link */}
        <button
          type="button"
          className="back-link"
          onClick={() => navigate('/phone-login')}
          disabled={loading}
        >
          <ArrowLeft size={16} />
          <span>Change Phone Number</span>
        </button>

        {/* Header */}
        <div className="otp-header">
          <div className="badge-glow">
            <Sparkles size={14} className="sparkle-icon" />
            <span>Enter OTP</span>
          </div>
          <h2 className="otp-title">Verify Mobile</h2>
          <p className="otp-subtitle">
            We've sent a 6-digit code to the number <strong className="phone-highlight">{phoneNumber}</strong>.
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleVerifyOtp} className="otp-form">
          <div className="form-group">
            <label className="input-label">Verification Code (6 Digits)</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input
                type="text"
                className={`glass-input code-input ${error ? 'input-error' : ''}`}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                disabled={loading}
                maxLength={6}
                autoFocus
              />
            </div>
          </div>

          <button type="submit" className="btn-primary submit-btn" disabled={loading}>
            <span>{loading ? 'Verifying OTP...' : 'Verify & Continue'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="otp-footer">
          <span>Didn't receive the SMS? </span>
          <button 
            type="button" 
            className="resend-link" 
            onClick={() => navigate('/phone-login')}
            disabled={loading}
          >
            Resend SMS
          </button>
        </div>
      </GlassContainer>

      <style>{`
        .otp-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 40px 16px;
          min-height: 75vh;
        }

        .otp-card {
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
          border: none;
          background: none;
          padding: 0;
          cursor: pointer;
        }

        .back-link:hover {
          color: var(--primary);
        }

        .otp-header {
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

        .otp-title {
          font-size: 2rem;
          color: var(--text-primary);
        }

        .otp-subtitle {
          color: var(--text-secondary);
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .phone-highlight {
          color: var(--text-primary);
          font-weight: 700;
          white-space: nowrap;
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

        .otp-form {
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

        .code-input {
          letter-spacing: 0.25em;
          font-size: 1.25rem;
          font-weight: 700;
          text-align: center;
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
        }

        .otp-footer {
          font-size: 0.88rem;
          color: var(--text-secondary);
          text-align: center;
        }

        .resend-link {
          background: none;
          border: none;
          color: var(--primary);
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          font-size: inherit;
        }

        .resend-link:hover {
          color: var(--primary-deep);
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
};

export default OtpVerification;
