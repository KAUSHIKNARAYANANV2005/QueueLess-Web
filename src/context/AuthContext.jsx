import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
    // Subscribe to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthError(null);

      if (firebaseUser) {
        setCurrentUser(firebaseUser);

        try {
          // Fetch the matching Firestore user document
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const profile = { id: userDocSnap.id, ...userDocSnap.data() };
            setUserProfile(profile);
            setRole(profile.role ?? null);
          } else {
            // User exists in Auth but has no Firestore record yet
            // (can happen mid-registration). Keep role null.
            setUserProfile(null);
            setRole(null);
          }
        } catch (err) {
          console.error('AuthContext: failed to fetch user profile', err);
          setAuthError(err.message);
          setUserProfile(null);
          setRole(null);
        }
      } else {
        // No authenticated user
        setCurrentUser(null);
        setUserProfile(null);
        setRole(null);
      }

      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  const value = {
    currentUser,
    userProfile,
    role,
    loading,
    authError,
    isAuthenticated: !!currentUser,
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
