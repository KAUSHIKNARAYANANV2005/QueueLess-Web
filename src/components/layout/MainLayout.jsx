import React, { useState, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import BottomNavigation from './BottomNavigation';
import useAuth from '../../hooks/useAuth';

const QueueBot = lazy(() => import('../chatbot/QueueBot'));

const MainLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { role, isAuthenticated } = useAuth();

  const showSidebar = isAuthenticated && role;

  // Derive active path from react-router-dom location (no more manual hash tracking)
  const currentPath = location.pathname;

  const handleNavigation = (path) => {
    navigate(path);
    setSidebarOpen(false); // close mobile sidebar on navigation
  };

  return (
    <div className="layout-container">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePath={currentPath}
        onNavigate={handleNavigation}
      />

      <main className={`main-content ${showSidebar ? 'has-sidebar' : ''}`}>
        {children}
      </main>

      <BottomNavigation
        activePath={currentPath}
        onNavigate={handleNavigation}
      />

      {isAuthenticated && (
        <Suspense fallback={null}>
          <QueueBot />
        </Suspense>
      )}

      <style>{`
        .layout-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .main-content {
          flex-grow: 1;
          padding: 32px;
          margin-top: 64px;
          margin-left: 0;
          transition: margin 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-sizing: border-box;
        }

        .main-content.has-sidebar {
          margin-left: 260px;
        }

        @media (max-width: 1024px) {
          .main-content, .main-content.has-sidebar {
            margin-left: 0;
            margin-bottom: 64px;
            padding: 24px 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default MainLayout;
