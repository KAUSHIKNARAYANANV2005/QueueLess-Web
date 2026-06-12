/**
 * Firebase Authentication Service Layer
 *
 * All auth operations live here.
 * Components call these functions — never import firebase/auth directly in pages.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './config';

// ─── Login ─────────────────────────────────────────────────────────────────────
/**
 * Sign in an existing user with email and password.
 * Returns the Firebase UserCredential on success.
 * Throws a Firebase AuthError on failure (caller handles it).
 */
export const loginWithEmail = async (email, password) => {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential;
};

// ─── Register Customer ─────────────────────────────────────────────────────────
/**
 * Creates a new Firebase Auth user and a matching Firestore /users/{uid} document
 * with role = 'customer'.
 *
 * Schema matches migration report: users collection.
 */
export const registerCustomer = async ({ name, email, password, phone }) => {
  // 1. Create Auth user
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;

  // 2. Write Firestore user document
  await setDoc(doc(db, 'users', uid), {
    id: uid,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone.trim(),
    role: 'customer',
    profileImage: null,
    walletBalance: 0.0,
    createdAt: serverTimestamp(),
  });

  return credential;
};

// ─── Register Business ─────────────────────────────────────────────────────────
/**
 * Creates a new Firebase Auth user, a /users/{uid} document with role = 'business',
 * and an initial /businesses/{businessId} document with ownerId = uid.
 *
 * Schema matches migration report: users + businesses collections.
 */
export const registerBusiness = async ({
  ownerName,
  email,
  password,
  phone,
  businessName,
  category,
  description,
  address,
  businessPhone,
}) => {
  // 1. Create Auth user
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;

  // 2. Write Firestore user document (owner profile)
  await setDoc(doc(db, 'users', uid), {
    id: uid,
    name: ownerName.trim(),
    email: email.toLowerCase().trim(),
    phone: phone.trim(),
    role: 'business',
    profileImage: null,
    walletBalance: 0.0,
    createdAt: serverTimestamp(),
  });

  // 3. Create initial business document — use uid as the business ID for simplicity
  //    (one business per owner at registration; owner can create more later)
  const businessRef = doc(collection(db, 'businesses'));
  const businessId = businessRef.id;

  await setDoc(businessRef, {
    id: businessId,
    name: businessName.trim(),
    category: category.trim(),
    description: description.trim(),
    address: address.trim(),
    lat: 0.0,
    lng: 0.0,
    phone: businessPhone.trim(),
    rating: 0.0,
    reviewCount: 0,
    isVerified: false,
    plan: 'free',
    coverImage: null,
    logoImage: null,
    hours: null,
    ownerId: uid,
    currentQueue: 0,
    isOpen: false,
    createdAt: serverTimestamp(),
  });

  return credential;
};

// ─── Forgot Password ───────────────────────────────────────────────────────────
/**
 * Sends a password reset email to the given address.
 */
export const sendPasswordReset = async (email) => {
  await sendPasswordResetEmail(auth, email.toLowerCase().trim());
};

// ─── Sign Out ──────────────────────────────────────────────────────────────────
/**
 * Signs the current user out of Firebase Auth.
 */
export const logOut = async () => {
  await signOut(auth);
};

// ─── Google Login ──────────────────────────────────────────────────────────────
/**
 * Signs in using Firebase Google Auth popup.
 */
export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(auth, provider);
  return credential;
};

// ─── Profile Completion Helpers ────────────────────────────────────────────────
/**
 * Completes customer profile creation for Google / Phone Auth users in Firestore.
 */
export const completeCustomerProfile = async (uid, { name, email, phone }) => {
  await setDoc(doc(db, 'users', uid), {
    id: uid,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone.trim(),
    role: 'customer',
    profileImage: null,
    walletBalance: 0.0,
    createdAt: serverTimestamp(),
  });
};

/**
 * Completes business profile creation for Google / Phone Auth users in Firestore.
 */
export const completeBusinessProfile = async (
  uid,
  {
    ownerName,
    email,
    phone,
    businessName,
    category,
    description,
    address,
    businessPhone,
  }
) => {
  // 1. Write user details
  await setDoc(doc(db, 'users', uid), {
    id: uid,
    name: ownerName.trim(),
    email: email.toLowerCase().trim(),
    phone: phone.trim(),
    role: 'business',
    profileImage: null,
    walletBalance: 0.0,
    createdAt: serverTimestamp(),
  });

  // 2. Create business document
  const businessRef = doc(collection(db, 'businesses'));
  const businessId = businessRef.id;

  await setDoc(businessRef, {
    id: businessId,
    name: businessName.trim(),
    category: category.trim(),
    description: description.trim(),
    address: address.trim(),
    lat: 0.0,
    lng: 0.0,
    phone: businessPhone.trim(),
    rating: 0.0,
    reviewCount: 0,
    isVerified: false,
    plan: 'free',
    coverImage: null,
    logoImage: null,
    hours: null,
    ownerId: uid,
    currentQueue: 0,
    isOpen: false,
    createdAt: serverTimestamp(),
  });

  return businessId;
};
