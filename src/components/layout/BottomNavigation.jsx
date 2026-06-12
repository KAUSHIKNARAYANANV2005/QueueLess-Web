import React from 'react';
import { 
  Home, Calendar, User, Bell, LayoutDashboard, 
  ListOrdered, Scissors, Users, Settings, Shield, TrendingUp 
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';

const BottomNavigation = ({ activePath = '/', onNavigate }) => {
  const { role, isAuthenticated } = useAuth();

  const navigate = (path) => {
    if (onNavigate) onNavigate(path);
    else window.location.hash = path;
  };

  // If not authenticated or no role is resolved, don't show bottom navigation
  if (!isAuthenticated || !role) {
    return null;
  }

  // Build items dynamically based on role
  let menuItems = [];
  if (role === 'customer') {
    menuItems = [
      { name: 'Home', path: '/home', icon: Home },
      { name: 'Bookings', path: '/appointments', icon: Calendar },
      { name: 'Notifications', path: '/notifications', icon: Bell },
      { name: 'Profile', path: '/profile', icon: User },
    ];
  } else if (role === 'business') {
    menuItems = [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Queues', path: '/queue-manager', icon: ListOrdered },
      { name: 'Services', path: '/services', icon: Scissors },
      { name: 'Staff', path: '/staff', icon: Users },
      { name: 'Settings', path: '/settings', icon: Settings },
    ];
  } else if (role === 'admin') {
    menuItems = [
      { name: 'Dashboard', path: '/admin', icon: Shield },
      { name: 'Reports', path: '/admin/reports', icon: TrendingUp },
    ];
  }

  return (
    <nav className="bottom-nav-container">
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = activePath === item.path;
        return (
          <button
            key={item.name}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <Icon size={20} />
            <span className="bottom-nav-label">{item.name}</span>
          </button>
        );
      })}

      <style>{`
        .bottom-nav-container {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 64px;
          background: var(--glass-bg);
          border-top: 1px solid var(--glass-border);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.05);
          z-index: 100;
          justify-content: space-around;
          align-items: center;
          padding: 0 8px;
          box-sizing: border-box;
        }

        .bottom-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          text-decoration: none;
          gap: 4px;
          flex: 1;
          height: 100%;
          transition: all 0.2s ease;
        }

        .bottom-nav-item:hover {
          color: var(--primary);
        }

        .bottom-nav-item.active {
          color: var(--primary);
        }

        .bottom-nav-label {
          font-size: 0.65rem;
          font-weight: 600;
        }

        @media (max-width: 1024px) {
          .bottom-nav-container {
            display: flex;
          }
        }
      `}</style>
    </nav>
  );
};

export default BottomNavigation;
