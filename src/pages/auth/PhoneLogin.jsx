import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Phone, AlertCircle, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import GlassContainer from '../../components/glass/GlassContainer';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../../firebase/config';

const PhoneLogin = () => {
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Cleanup any lingering RecaptchaVerifier on unmount
    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        } catch (e) {
          console.error('Error clearing recaptcha verifier:', e);
        }
      }
    };
  }, []);

  const validate = () => {
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneNumber.trim()) {
      setError('Phone number is required.');
      return false;
    } else if (!phoneRegex.test(phoneNumber.trim())) {
      setError('Please enter a valid 10-digit phone number.');
      return false;
    }
    setError('');
    return true;
  };

  const getFriendlyErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/invalid-phone-number':
        return 'The phone number entered is invalid. Please check and try again.';
      case 'auth/quota-exceeded':
        return 'SMS quota exceeded for today. Please try again later.';
      case 'auth/too-many-requests':
        return 'Too many request attempts. Please wait before trying again.';
      case 'auth/captcha-check-failed':
        return 'reCAPTCHA verification failed. Please refresh and try again.';
      default:
        return 'Failed to send verification SMS. Please try again.';
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setLoading(true);
    const formattedPhone = `+91${phoneNumber.trim()}`;

    try {
      // Initialize reCAPTCHA verifier if not already done
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            // reCAPTCHA solved
          }
        });
      }

      const appVerifier = window.recaptchaVerifier;
      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      
      // Save confirmationResult in window object to preserve it across routing
      window.confirmationResult = confirmationResult;

      // Navigate to OTP page and pass formatted number in state
      navigate('/otp', { state: { phoneNumber: formattedPhone } });
    } catch (err) {
      console.error('Phone SMS send error:', err);
      setError(getFriendlyErrorMessage(err.code || err.message));
      
      // Reset reCAPTCHA on failure so it can be re-instantiated
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        } catch (e) {
          console.error(e);
        }
      }
      setLoading(false);
    }
  };

  return (
    <div className="phone-login-wrapper animate-fade-in">
      <GlassContainer className="phone-login-card">
        {/* Back link */}
        <Link to="/login" className="back-link">
          <ArrowLeft size={16} />
          <span>Back to Login</span>
        </Link>

        {/* Header */}
        <div className="phone-login-header">
          <div className="badge-glow">
            <Sparkles size={14} className="sparkle-icon" />
            <span>Secure Access</span>
          </div>
          <h2 className="phone-login-title">Phone Sign In</h2>
          <p className="phone-login-subtitle">
            Enter your mobile number to receive a 6-digit verification code.
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
        <form onSubmit={handleSendOtp} className="phone-login-form">
          <div className="form-group">
            <label className="input-label">Mobile Number</label>
            <div className="phone-input-row">
              <div className="country-code">+91</div>
              <div className="input-wrapper">
                <Phone className="input-icon" size={18} />
                <input
                  type="tel"
                  className={`glass-input ${error ? 'input-error' : ''}`}
                  placeholder="9876543210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  maxLength={10}
                />
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary submit-btn" disabled={loading}>
            <span>{loading ? 'Sending SMS...' : 'Send OTP Code'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Invisible recaptcha container */}
        <div id="recaptcha-container"></div>
      </GlassContainer>

      <style>{`
        .phone-login-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 40px 16px;
          min-height: 75vh;
        }

        .phone-login-card {
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

        .phone-login-header {
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

        .phone-login-title {
          font-size: 2rem;
          color: var(--text-primary);
        }

        .phone-login-subtitle {
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

        .phone-login-form {
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

        .phone-input-row {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .country-code {
          padding: 12px 16px;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-sm);
          color: var(--text-primary);
          font-weight: 600;
          font-size: 1rem;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          flex: 1;
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
        }
      `}</style>
    </div>
  );
};

export default PhoneLogin;
