import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { ROLE_HOME } from '../../context/AuthContext';
import AuthLoadingScreen from './AuthLoadingScreen';

/**
 * GuestRoute
 *
 * Wraps routes that only unauthenticated users should reach
 * (e.g. /login, /register, /onboarding).
 *
 * Redirect logic:
 *   • Auth loading      → show <AuthLoadingScreen />
 *   • Already logged in → redirect to their role-based home page
 *   • Not logged in     → render children (the guest page)
 */
const GuestRoute = ({ children }) => {
  const { isAuthenticated, role, loading } = useAuth();

  // 1. Still resolving Firebase auth state
  if (loading) return <AuthLoadingScreen />;

  // 2. Authenticated user hitting a guest page → bounce to their home or role-selection
  if (isAuthenticated) {
    if (!role) {
      return <Navigate to="/role-selection" replace />;
    }
    const destination = ROLE_HOME[role] ?? '/home';
    return <Navigate to={destination} replace />;
  }

  // 3. Not authenticated → show the guest page
  return children;
};

export default GuestRoute;
