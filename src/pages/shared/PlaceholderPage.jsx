import React from 'react';
import { useNavigate } from 'react-router-dom';
import GlassContainer from '../../components/glass/GlassContainer';
import { Hourglass, ArrowLeft } from 'lucide-react';

/**
 * PlaceholderPage
 *
 * Renders a clean "Under Construction" glass card for routes not yet built.
 * Used during Phase 2B to allow route guard testing without real page UI.
 *
 * Props:
 *   title  – display name of the route/page
 *   phase  – the planned build phase number
 */
const PlaceholderPage = ({ title = 'Page', phase = '?' }) => {
  const navigate = useNavigate();

  return (
    <div className="ph-root animate-fade-in">
      <GlassContainer className="ph-card">
        <div className="ph-icon-wrap">
          <Hourglass size={42} className="ph-icon" />
        </div>

        <div className="ph-content">
          <span className="ph-phase-badge">Phase {phase}</span>
          <h2 className="ph-title">{title}</h2>
          <p className="ph-desc">
            This page is scheduled for Phase {phase} of the QueueLess migration plan.
            Route guards and role-based access are already active — this placeholder
            confirms the route is correctly protected.
          </p>
        </div>

        <button className="btn-primary ph-back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
          Back to Welcome
        </button>
      </GlassContainer>

      <style>{`
        .ph-root {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 128px);
          padding: 24px;
          box-sizing: border-box;
        }

        .ph-card {
          max-width: 500px;
          width: 100%;
          padding: 44px 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          text-align: center;
          box-sizing: border-box;
        }

        .ph-icon-wrap {
          width: 84px;
          height: 84px;
          border-radius: 50%;
          background: rgba(108, 99, 255, 0.08);
          border: 1px solid rgba(108, 99, 255, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ph-icon {
          color: var(--primary);
          animation: ph-pulse 2s ease-in-out infinite;
        }

        @keyframes ph-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }

        .ph-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .ph-phase-badge {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          background: rgba(108, 99, 255, 0.12);
          color: var(--primary);
          padding: 4px 12px;
          border-radius: 50px;
          border: 1px solid rgba(108, 99, 255, 0.2);
        }

        .ph-title {
          font-size: 1.6rem;
          color: var(--text-primary);
          margin: 0;
        }

        .ph-desc {
          font-size: 0.92rem;
          color: var(--text-secondary);
          line-height: 1.6;
          max-width: 380px;
          margin: 0;
        }

        .ph-back-btn {
          padding: 11px 22px;
          font-size: 0.9rem;
          gap: 8px;
        }
      `}</style>
    </div>
  );
};

export default PlaceholderPage;
