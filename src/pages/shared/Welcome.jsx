import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import GlassContainer from '../../components/glass/GlassContainer';
import { useTheme } from '../../context/ThemeContext';
import { Users, Zap, Clock, ShieldCheck, ArrowRight, Bot, PhoneCall, Sparkles, Server, CheckCircle, AlertTriangle, XCircle, Play } from 'lucide-react';
import { testFirebaseConnection } from '../../firebase/test-connection';
import useAuth from '../../hooks/useAuth';
import { ROLE_HOME } from '../../context/AuthContext';

const Welcome = () => {
  const navigate = useNavigate();
  const { role, loading, isAuthenticated } = useAuth();
  const [testReport, setTestReport] = useState(null);
  const [testing, setTesting] = useState(false);

  // 1. If auth state is still resolving, show a premium animated splash loader
  if (loading) {
    return (
      <div className="splash-screen-root">
        <div className="splash-screen-card">
          <div className="splash-screen-icon">
            <Zap size={40} fill="var(--primary)" color="var(--primary)" />
          </div>
          <div className="splash-screen-ring" />
          <h2 className="splash-screen-brand">QueueLess</h2>
          <p className="splash-screen-label">Connecting to venue...</p>
        </div>

        <style>{`
          .splash-screen-root {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #0A0814 0%, #15112D 100%);
            z-index: 9999;
          }
          .splash-screen-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            position: relative;
          }
          .splash-screen-icon {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: rgba(108, 99, 255, 0.12);
            border: 1px solid rgba(108, 99, 255, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            z-index: 1;
            animation: splash-float 2s ease-in-out infinite;
          }
          .splash-screen-ring {
            position: absolute;
            top: 25px;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 100px;
            height: 100px;
            border-radius: 50%;
            border: 2.5px solid transparent;
            border-top-color: var(--primary);
            border-right-color: var(--primary);
            animation: splash-spin 1.2s linear infinite;
          }
          .splash-screen-brand {
            font-family: 'Outfit', sans-serif;
            font-size: 2.2rem;
            font-weight: 800;
            color: #FFFFFF;
            letter-spacing: -0.04em;
            margin: 10px 0 0 0;
            background: linear-gradient(135deg, #FFFFFF 0%, #A5A0C5 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .splash-screen-label {
            font-family: 'Outfit', sans-serif;
            font-size: 0.95rem;
            font-weight: 500;
            color: var(--text-secondary);
            letter-spacing: 0.02em;
            margin: 0;
          }
          @keyframes splash-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          @keyframes splash-spin {
            to { transform: translate(-50%, -50%) rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // 2. If authenticated and has a role, automatically redirect to their respective home
  if (isAuthenticated) {
    if (!role) {
      return <Navigate to="/role-selection" replace />;
    }
    const destination = ROLE_HOME[role] ?? '/home';
    return <Navigate to={destination} replace />;
  }

  const handlePortalNavigate = (route) => {
    navigate(route);
  };

  const runDiagnostics = async () => {
    setTesting(true);
    try {
      const report = await testFirebaseConnection();
      setTestReport(report);
    } catch (err) {
      setTestReport({
        status: 'fail',
        message: 'Diagnostics execution error: ' + err.message,
        appInitialized: false,
        authInitialized: false,
        dbInitialized: false,
        storageInitialized: false
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="welcome-wrapper animate-fade-in">
      {/* Hero Header */}
      <section className="hero-section">
        <div className="badge-glow">
          <Sparkles size={14} className="sparkle-icon" />
          <span>Next-Gen Queue Management</span>
        </div>
        <h1 className="hero-title">
          Experience <span className="gradient-text">QueueLess</span>
        </h1>
        <p className="hero-subtitle">
          Eliminating physical waiting lines in clinics, salons, and banking hubs. Replicating the native Android core with 1:1 real-time Firestore synchronization.
        </p>
      </section>

      {/* Live Sync Analytics Grid Mock */}
      <section className="stats-grid">
        <GlassContainer className="stat-card">
          <div className="stat-icon-wrapper customer-accent">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Active Waiting Users</span>
            <h3 className="stat-value">1,402</h3>
            <span className="stat-trend">+12% from last hour</span>
          </div>
        </GlassContainer>

        <GlassContainer className="stat-card">
          <div className="stat-icon-wrapper active-accent">
            <Zap size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Active Serving Venues</span>
            <h3 className="stat-value">48</h3>
            <span className="stat-trend">Live across 4 districts</span>
          </div>
        </GlassContainer>

        <GlassContainer className="stat-card">
          <div className="stat-icon-wrapper wait-accent">
            <Clock size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Avg. Wait Time Saved</span>
            <h3 className="stat-value">34 <small>mins</small></h3>
            <span className="stat-trend">Computed by AI predictor</span>
          </div>
        </GlassContainer>
      </section>

      {/* Firebase Diagnostics Widget */}
      <section className="diagnostics-section">
        <GlassContainer className="diagnostics-card">
          <div className="diagnostics-header">
            <div className="diagnostics-title">
              <Server size={18} className="server-icon" />
              <h3>Firebase Core Diagnostics</h3>
            </div>
            <button 
              className="btn-primary btn-diagnostics" 
              onClick={runDiagnostics} 
              disabled={testing}
            >
              <span>{testing ? 'Running...' : 'Run Diagnostics'}</span>
              <Play size={14} fill={testing ? 'none' : 'currentColor'} />
            </button>
          </div>

          {!testReport ? (
            <p className="diagnostics-intro">
              Initialize connection diagnostics to verify Firebase client setup, Vite environment bindings, and Firestore database reachability.
            </p>
          ) : (
            <div className="diagnostics-results animate-fade-in">
              <div className={`status-banner ${testReport.status}`}>
                {testReport.status === 'success' && <CheckCircle size={18} />}
                {testReport.status === 'warn' && <AlertTriangle size={18} />}
                {testReport.status === 'fail' && <XCircle size={18} />}
                <span>{testReport.message}</span>
              </div>

              <div className="diagnostics-details">
                <div className="detail-item">
                  <span className="detail-name">Firebase App</span>
                  <span className={`detail-status ${testReport.appInitialized ? 'ok' : 'err'}`}>
                    {testReport.appInitialized ? 'Initialized' : 'Failed'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-name">Auth Service</span>
                  <span className={`detail-status ${testReport.authInitialized ? 'ok' : 'err'}`}>
                    {testReport.authInitialized ? 'Loaded' : 'Failed'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-name">Firestore Database</span>
                  <span className={`detail-status ${testReport.dbInitialized ? 'ok' : 'err'}`}>
                    {testReport.dbInitialized ? 'Loaded' : 'Failed'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-name">Storage Service</span>
                  <span className={`detail-status ${testReport.storageInitialized ? 'ok' : 'err'}`}>
                    {testReport.storageInitialized ? 'Loaded' : 'Failed'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </GlassContainer>
      </section>

      {/* Role Selection Portals */}
      <section className="portals-section">
        <h2 className="section-header">Select Your Portal</h2>
        <div className="portals-grid">
          <GlassContainer className="portal-card glass-panel-hover">
            <div className="portal-badge customer-badge">Customer</div>
            <h3>Looking for a venue?</h3>
            <p>Find nearby salons, clinics, or bank offices. Check real-time queue lengths and book virtual slots immediately.</p>
            <button className="btn-primary" onClick={() => handlePortalNavigate('/home')}>
              <span>Enter Customer App</span>
              <ArrowRight size={18} />
            </button>
          </GlassContainer>

          <GlassContainer className="portal-card glass-panel-hover">
            <div className="portal-badge business-badge">Merchant</div>
            <h3>Manage your storefront?</h3>
            <p>Administer active queues, call next tokens, coordinate staff and services listings, and query shop analytics dashboards.</p>
            <button className="btn-glass" onClick={() => handlePortalNavigate('/dashboard')}>
              <span>Enter Merchant Portal</span>
              <ArrowRight size={18} />
            </button>
          </GlassContainer>
        </div>
      </section>

      {/* System Features list */}
      <section className="features-section">
        <h2 className="section-header">Core Web Architecture Replicated</h2>
        <div className="features-list">
          <div className="feature-item">
            <div className="feature-marker"><ShieldCheck size={20} /></div>
            <div className="feature-info">
              <h4>1:1 Real-Time Synchronization</h4>
              <p>Establishing native snapshot listeners to synchronize changes instantly between Flutter mobile and React web clients.</p>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-marker"><Bot size={20} /></div>
            <div className="feature-info">
              <h4>QueueBot AI Interface</h4>
              <p>Chatbot powered by isolated Gemini hooks with placeholders for serverless proxy triggers, preventing frontend API exposure.</p>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-marker"><PhoneCall size={20} /></div>
            <div className="feature-info">
              <h4>Browser SMS Authentication</h4>
              <p>Replicating mobile auth workflows with invisible reCAPTCHA validations supporting secure OTP collections.</p>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .welcome-wrapper {
          max-width: 1000px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 48px;
          padding: 16px 0;
        }

        .hero-section {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .badge-glow {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(108, 99, 255, 0.12);
          border: 1px solid rgba(108, 99, 255, 0.2);
          color: var(--primary);
          padding: 6px 14px;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          animation: pulseGlow 3s infinite;
        }

        .sparkle-icon {
          color: var(--primary);
        }

        .hero-title {
          font-size: 3.5rem;
          line-height: 1.1;
          color: var(--text-primary);
        }

        .gradient-text {
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-deep) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-subtitle {
          max-width: 650px;
          font-size: 1.15rem;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 24px;
          box-sizing: border-box;
        }

        .stat-icon-wrapper {
          width: 52px;
          height: 52px;
          border-radius: var(--border-radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
        }

        .customer-accent {
          background: linear-gradient(135deg, #FF6584 0%, #FF3366 100%);
          box-shadow: 0 4px 14px rgba(255, 101, 132, 0.25);
        }

        .active-accent {
          background: linear-gradient(135deg, #00F5D4 0%, #00BFA5 100%);
          box-shadow: 0 4px 14px rgba(0, 245, 212, 0.25);
        }

        .wait-accent {
          background: linear-gradient(135deg, #6C63FF 0%, #4E44E7 100%);
          box-shadow: 0 4px 14px rgba(108, 99, 255, 0.25);
        }

        .stat-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-label {
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-weight: 600;
        }

        .stat-value {
          font-size: 1.75rem;
          color: var(--text-primary);
          margin: 0;
          font-weight: 700;
        }

        .stat-value small {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .stat-trend {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .portals-section {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .section-header {
          text-align: center;
          font-size: 1.75rem;
          color: var(--text-primary);
        }

        .portals-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 24px;
        }

        .portal-card {
          padding: 36px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: flex-start;
          text-align: left;
          position: relative;
          box-sizing: border-box;
        }

        .portal-badge {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 10px;
          border-radius: 50px;
          color: #FFFFFF;
        }

        .customer-badge {
          background: var(--coral);
        }

        .business-badge {
          background: var(--primary);
        }

        .portal-card h3 {
          font-size: 1.4rem;
          color: var(--text-primary);
        }

        .portal-card p {
          color: var(--text-secondary);
          font-size: 0.95rem;
          line-height: 1.5;
          margin-bottom: 8px;
        }

        .portal-card button {
          width: 100%;
        }

        .features-section {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .features-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .feature-item {
          display: flex;
          gap: 16px;
          text-align: left;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          padding: 20px;
          border-radius: var(--border-radius-md);
        }

        .feature-marker {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(108, 99, 255, 0.1);
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .feature-info h4 {
          font-size: 1.05rem;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .feature-info p {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .diagnostics-section {
          width: 100%;
        }

        .diagnostics-card {
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          text-align: left;
          box-sizing: border-box;
        }

        .diagnostics-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .diagnostics-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .server-icon {
          color: var(--primary);
        }

        .diagnostics-title h3 {
          font-size: 1.25rem;
          margin: 0;
          color: var(--text-primary);
        }

        .btn-diagnostics {
          padding: 10px 20px;
          font-size: 0.9rem;
          gap: 6px;
        }

        .diagnostics-intro {
          font-size: 0.95rem;
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0;
        }

        .diagnostics-results {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .status-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          border-radius: var(--border-radius-sm);
          font-size: 0.95rem;
          font-weight: 500;
          border: 1px solid transparent;
        }

        .status-banner.success {
          background: rgba(0, 245, 212, 0.08);
          border-color: rgba(0, 245, 212, 0.2);
          color: #00BFA5;
        }

        .status-banner.warn {
          background: rgba(255, 189, 89, 0.08);
          border-color: rgba(255, 189, 89, 0.2);
          color: #E68A00;
        }

        .status-banner.fail {
          background: rgba(255, 101, 132, 0.08);
          border-color: rgba(255, 101, 132, 0.2);
          color: #E63956;
        }

        .diagnostics-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: rgba(108, 99, 255, 0.04);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-sm);
          font-size: 0.88rem;
        }

        .detail-name {
          color: var(--text-secondary);
          font-weight: 500;
        }

        .detail-status {
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
        }

        .detail-status.ok {
          background: rgba(0, 245, 212, 0.1);
          color: #00BFA5;
        }

        .detail-status.err {
          background: rgba(255, 101, 132, 0.1);
          color: #E63956;
        }

        @media (max-width: 768px) {
          .hero-title {
            font-size: 2.5rem;
          }
          .welcome-wrapper {
            gap: 32px;
          }
        }
      `}</style>
    </div>
  );
};

export default Welcome;
