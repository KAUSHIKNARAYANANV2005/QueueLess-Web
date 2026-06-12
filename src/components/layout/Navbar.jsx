import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon, Bell, Menu, Zap, User, Settings, Shield, LogOut } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import useAuth from '../../hooks/useAuth';
import { useBooking } from '../../context/BookingContext';
import { logOut } from '../../firebase/auth';

const Navbar = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { currentUser, userProfile, role } = useAuth();
  const { clearBookingState } = useBooking();
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Subscribe to unread notifications count in real-time
  useEffect(() => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      where('isRead', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      setUnreadCount(snap.size);
    }, (err) => {
      console.error("Navbar notifications listener error:", err);
    });
    return () => unsub();
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      setDropdownOpen(false);
      await logOut();
      clearBookingState();
      navigate('/login');
    } catch (err) {
      console.error("Navbar: logout error", err);
    }
  };

  const avatarSrc = userProfile?.profileImage || currentUser?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80';

  return (
    <header className="navbar-container">
      <div className="navbar-left">
        <button className="mobile-menu-btn" onClick={onMenuClick}>
          <Menu size={24} />
        </button>
        <div className="brand-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <Zap className="brand-icon" size={24} fill="var(--primary)" />
          <span>QueueLess</span>
        </div>
      </div>
      
      <div className="navbar-right">
        <button className="nav-icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={20} className="sun-icon" /> : <Moon size={20} className="moon-icon" />}
        </button>
        
        <button 
          className="nav-icon-btn" 
          aria-label="Notifications"
          onClick={() => navigate('/notifications')}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="notif-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        
        {currentUser && (
          <div className="user-avatar-dropdown-container">
            <button 
              className="user-profile-avatar" 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-label="Toggle profile menu"
              style={{ border: '2px solid var(--primary)', background: 'none', cursor: 'pointer' }}
            >
              <img 
                src={avatarSrc} 
                alt="User avatar" 
              />
            </button>
            
            {dropdownOpen && (
              <>
                <div className="dropdown-click-overlay" onClick={() => setDropdownOpen(false)} />
                <div className="avatar-dropdown-menu glass-panel animate-fade-in">
                  <div className="dropdown-profile-header">
                    <p className="dropdown-name">{userProfile?.name || currentUser.displayName || 'User'}</p>
                    <p className="dropdown-email">{userProfile?.email || currentUser.email}</p>
                  </div>
                  <div className="dropdown-divider" />
                  <div className="dropdown-menu-list">
                    {role === 'customer' && (
                      <button className="dropdown-menu-item" onClick={() => { navigate('/profile'); setDropdownOpen(false); }}>
                        <User size={16} />
                        <span>My Profile</span>
                      </button>
                    )}
                    {role === 'business' && (
                      <button className="dropdown-menu-item" onClick={() => { navigate('/settings'); setDropdownOpen(false); }}>
                        <Settings size={16} />
                        <span>Business Settings</span>
                      </button>
                    )}
                    {role === 'admin' && (
                      <button className="dropdown-menu-item" onClick={() => { navigate('/admin'); setDropdownOpen(false); }}>
                        <Shield size={16} />
                        <span>Admin Dashboard</span>
                      </button>
                    )}
                    <button className="dropdown-menu-item" onClick={() => { navigate('/notifications'); setDropdownOpen(false); }}>
                      <Bell size={16} />
                      <span>Notifications</span>
                    </button>
                    <div className="dropdown-divider" />
                    <button className="dropdown-menu-item logout-item" onClick={handleLogout}>
                      <LogOut size={16} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        .navbar-container {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 64px;
          background: var(--glass-bg);
          border-bottom: 1px solid var(--glass-border);
          box-shadow: var(--glass-shadow);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          box-sizing: border-box;
        }

        .navbar-left, .navbar-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .mobile-menu-btn {
          display: none;
          color: var(--text-primary);
        }

        .brand-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'Outfit', sans-serif;
          font-size: 1.3rem;
          font-weight: 700;
          letter-spacing: -0.03em;
          color: var(--text-primary);
        }

        .brand-icon {
          color: var(--primary);
        }

        .nav-icon-btn {
          background: rgba(108, 99, 255, 0.08);
          border: 1px solid rgba(108, 99, 255, 0.1);
          color: var(--text-primary);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          position: relative;
        }

        .nav-icon-btn:hover {
          background: rgba(108, 99, 255, 0.18);
          transform: scale(1.05);
        }

        .sun-icon {
          color: var(--amber);
        }

        .moon-icon {
          color: var(--primary-deep);
        }

        .notif-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          background: var(--coral);
          color: white;
          font-size: 0.65rem;
          font-weight: 700;
          height: 18px;
          min-width: 18px;
          padding: 0 4px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--glass-bg);
          box-sizing: border-box;
        }

        .user-avatar-dropdown-container {
          position: relative;
        }

        .user-profile-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid var(--primary);
          cursor: pointer;
          transition: transform 0.2s ease;
          background: none;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .user-profile-avatar:hover {
          transform: scale(1.05);
        }

        .user-profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .dropdown-click-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
        }

        .avatar-dropdown-menu {
          position: absolute;
          top: 50px;
          right: 0;
          width: 240px;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          z-index: 101;
          display: flex;
          flex-direction: column;
          padding: 16px;
          box-sizing: border-box;
          animation: dropdown-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .dropdown-profile-header {
          display: flex;
          flex-direction: column;
          gap: 2px;
          text-align: left;
        }

        .dropdown-name {
          font-family: 'Outfit', sans-serif;
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .dropdown-email {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin: 0;
          word-break: break-all;
        }

        .dropdown-divider {
          height: 1px;
          background: var(--glass-border);
          margin: 12px 0;
        }

        .dropdown-menu-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .dropdown-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          width: 100%;
          border: none;
          background: none;
          color: var(--text-secondary);
          font-size: 0.88rem;
          font-weight: 500;
          border-radius: var(--border-radius-sm);
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .dropdown-menu-item:hover {
          color: var(--primary);
          background: rgba(108, 99, 255, 0.08);
        }

        .dropdown-menu-item.logout-item {
          color: var(--text-secondary);
        }

        .dropdown-menu-item.logout-item:hover {
          color: var(--coral);
          background: rgba(255, 101, 132, 0.08);
        }

        @keyframes dropdown-fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 1024px) {
          .mobile-menu-btn {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .navbar-container {
            padding: 0 16px;
          }
        }
      `}</style>
    </header>
  );
};

export default Navbar;
