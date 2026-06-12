/**
 * useAuth – clean custom hook for consuming AuthContext.
 *
 * Usage:
 *   const { currentUser, userProfile, role, loading, authError, isAuthenticated } = useAuth();
 */
import { useAuthContext } from '../context/AuthContext';

const useAuth = () => useAuthContext();

export default useAuth;
