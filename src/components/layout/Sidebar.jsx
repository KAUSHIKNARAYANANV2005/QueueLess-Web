import React from 'react';
import { 
  Home, Calendar, User, LayoutDashboard, Settings, 
  HelpCircle, Shield, ListOrdered, Scissors, Users, 
  MessageSquare, Bell, TrendingUp, LogOut 
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { useBooking } from '../../context/BookingContext';
import { logOut } from '../../firebase/auth';

const Sidebar = ({ isOpen, onClose, activePath = '/', onNavigate }) => {
  const { role, isAuthenticated } = useAuth();
  const { clearBookingState } = useBooking();

  const navigate = (path) => {
    if (onNavigate) onNavigate(path);
    else window.location.hash = path;
  };

  const handleLogout = async () => {
    try {
      await logOut();
      clearBookingState();
      navigate('/login');
    } catch (err) {
      console.error('Sidebar: logout error', err);
    }
  };

  // If not authenticated or no role is resolved, don't show the sidebar at all
  if (!isAuthenticated || !role) {
    return null;
  }

  // Build items dynamically based on role
  let items = [];
  if (role === 'customer') {
    items = [
      { name: 'Home', path: '/home', icon: Home },
      { name: 'Appointments', path: '/appointments', icon: Calendar },
      { name: 'Profile', path: '/profile', icon: User },
      { name: 'Notifications', path: '/notifications', icon: Bell },
      { name: 'Help & Support', path: '/help', icon: HelpCircle },
    ];
  } else if (role === 'business') {
    items = [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Queue Manager', path: '/queue-manager', icon: ListOrdered },
      { name: 'Services', path: '/services', icon: Scissors },
      { name: 'Staff', path: '/staff', icon: Users },
      { name: 'Settings', path: '/settings', icon: Settings },
      { name: 'Reviews', path: '/reviews', icon: MessageSquare },
      { name: 'Notifications', path: '/notifications', icon: Bell },
    ];
  } else if (role === 'admin') {
    items = [
      { name: 'Admin Dashboard', path: '/admin', icon: Shield },
      { name: 'Reports', path: '/admin/reports', icon: TrendingUp },
    ];
  }

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
      
      <aside className={`sidebar-container ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-sections">
          <div className="sidebar-section">
            <span className="section-title">
              {role === 'customer' && 'Customer Portal'}
              {role === 'business' && 'Merchant Portal'}
              {role === 'admin' && 'Admin Portal'}
            </span>
            <nav className="sidebar-nav">
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = activePath === item.path;
                return (
                  <button
                    key={item.name}
                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                    onClick={() => navigate(item.path)}
                  >
                    <Icon size={18} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="sidebar-footer">
          <button
            className="sidebar-link logout-btn"
            onClick={handleLogout}
            style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>

        <style>{`
          .sidebar-container {
            position: fixed;
            top: 64px;
            left: 0;
            bottom: 0;
            width: 260px;
            background: var(--glass-bg);
            border-right: 1px solid var(--glass-border);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            z-index: 90;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 24px 16px;
            box-sizing: border-box;
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }

          .sidebar-sections {
            display: flex;
            flex-direction: column;
            gap: 28px;
          }

          .sidebar-section {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .section-title {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-secondary);
            font-weight: 700;
            padding-left: 12px;
          }

          .sidebar-nav {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .sidebar-link {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            color: var(--text-secondary);
            font-weight: 500;
            font-size: 0.95rem;
            border-radius: var(--border-radius-sm);
            transition: all 0.2s ease;
          }

          .sidebar-link:hover {
            color: var(--primary);
            background: rgba(108, 99, 255, 0.06);
            transform: translateX(4px);
          }

          .sidebar-link.logout-btn:hover {
            color: var(--coral);
            background: rgba(255, 101, 132, 0.08);
            transform: translateX(4px);
          }

          .sidebar-link.active {
            color: #FFFFFF;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-deep) 100%);
            box-shadow: 0 4px 12px rgba(108, 99, 255, 0.2);
          }

          .sidebar-footer {
            border-top: 1px solid var(--glass-border);
            padding-top: 16px;
          }

          .sidebar-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(4px);
            z-index: 85;
          }

          @media (max-width: 1024px) {
            .sidebar-container {
              transform: translateX(-100%);
              top: 0;
              z-index: 120;
            }
            .sidebar-container.open {
              transform: translateX(0);
            }
            .sidebar-overlay {
              z-index: 110;
            }
          }
        `}</style>
      </aside>
    </>
  );
};

export default Sidebar;
