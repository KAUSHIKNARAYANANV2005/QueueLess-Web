import React from 'react';
import { Zap } from 'lucide-react';

/**
 * AuthLoadingScreen
 *
 * Shown while onAuthStateChanged is still resolving (typically < 1 second).
 * Prevents a flash of the wrong page before auth state is known.
 */
const AuthLoadingScreen = () => {
  return (
    <div className="auth-loading-root">
      <div className="auth-loading-card">
        <div className="auth-loading-icon animate-float">
          <Zap size={36} fill="var(--primary)" color="var(--primary)" />
        </div>
        <div className="auth-loading-ring" />
        <p className="auth-loading-label">Verifying session…</p>
      </div>

      <style>{`
        .auth-loading-root {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-gradient);
          z-index: 9999;
        }

        .auth-loading-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          position: relative;
        }

        .auth-loading-icon {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: rgba(108, 99, 255, 0.12);
          border: 1px solid rgba(108, 99, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 1;
        }

        .auth-loading-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 88px;
          height: 88px;
          border-radius: 50%;
          border: 2px solid transparent;
          border-top-color: var(--primary);
          border-right-color: var(--primary);
          animation: auth-spin 1s linear infinite;
        }

        .auth-loading-label {
          font-family: 'Outfit', sans-serif;
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--text-secondary);
          letter-spacing: 0.02em;
          margin: 0;
        }

        @keyframes auth-spin {
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AuthLoadingScreen;
