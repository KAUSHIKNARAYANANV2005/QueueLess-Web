import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

// ─── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ─── Role-based redirect map ───────────────────────────────────────────────────
export const ROLE_HOME = {
  customer: '/home',
  business: '/dashboard',
  admin: '/admin',
};

// ─── Provider ──────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);   // Firebase Auth user object
  const [userProfile, setUserProfile] = useState(null);   // Firestore /users/{uid} doc
  const [role, setRole] = useState(null);                 // 'customer' | 'business' | 'admin'
  const [loading, setLoading] = useState(true);           // true while auth state resolves
  const [authError, setAuthError] = useState(null);       // any error during profile fetch

  useEffect(() => {
    let unsubSnapshot = null;

    // Subscribe to Firebase Auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthError(null);

      // Clean up previous Firestore snapshot listener if any
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }

      if (firebaseUser) {
        setCurrentUser(firebaseUser);

        // Subscribe to real-time updates on the users/{uid} document
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        unsubSnapshot = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const profile = { id: docSnap.id, ...docSnap.data() };
              setUserProfile(profile);
              setRole(profile.role ?? null);
            } else {
              setUserProfile(null);
              setRole(null);
            }
            setLoading(false);
          },
          (err) => {
            console.error('AuthContext: failed to listen to user profile', err);
            setAuthError(err.message);
            setUserProfile(null);
            setRole(null);
            setLoading(false);
          }
        );
      } else {
        // No authenticated user
        setCurrentUser(null);
        setUserProfile(null);
        setRole(null);
        setLoading(false);
      }
    });

    // Cleanup listeners on unmount
    return () => {
      unsubscribeAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  const reloadUserProfile = async () => {
    if (!currentUser) return;
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const profile = { id: userDocSnap.id, ...userDocSnap.data() };
        setUserProfile(profile);
        setRole(profile.role ?? null);
      }
    } catch (err) {
      console.error('AuthContext: manual reload failed', err);
    }
  };

  const value = {
    currentUser,
    userProfile,
    role,
    loading,
    authError,
    isAuthenticated: !!currentUser,
    reloadUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ─── Internal hook export (also re-exported via src/hooks/useAuth.js) ──────────
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used inside an <AuthProvider>');
  }
  return context;
};
