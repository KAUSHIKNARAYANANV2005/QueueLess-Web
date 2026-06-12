import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { ROLE_HOME } from '../../context/AuthContext';
import AuthLoadingScreen from './AuthLoadingScreen';

/**
 * ProtectedRoute
 *
 * Wraps routes that require authentication and optionally a specific role.
 *
 * Props:
 *   allowedRoles  – string[] – e.g. ['customer'] | ['business'] | ['admin']
 *                  If omitted, any authenticated user is allowed.
 *   children      – the protected page element
 *
 * Redirect logic:
 *   • Auth loading  → show <AuthLoadingScreen />
 *   • Not logged in → /login
 *   • Wrong role    → their own role's home (e.g. a customer hitting /dashboard → /home)
 *   • Correct role  → render children
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  // 1. Still resolving Firebase auth state
  if (loading) return <AuthLoadingScreen />;

  // 2. Not authenticated at all → send to login, preserve intended destination
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2.5. Authenticated but has no Firestore role/profile → force to role-selection
  if (!role) {
    return <Navigate to="/role-selection" replace />;
  }

  // 3. Role check (only enforced when allowedRoles is specified)
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    // Redirect to the user's correct home based on their actual role
    const fallback = ROLE_HOME[role] ?? '/login';
    return <Navigate to={fallback} replace />;
  }

  // 4. All checks passed – render the child page
  return children;
};

export default ProtectedRoute;
