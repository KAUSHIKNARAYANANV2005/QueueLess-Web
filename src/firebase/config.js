import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

// Verify configurations are loaded via Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Log warning if variables are missing
if (!import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY.includes('Placeholder')) {
  console.warn(
    'Firebase Config: API key is missing or configured with placeholder values. Please check your local .env configuration.'
  );
}

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize services with safe fallbacks
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Safe export for Messaging (FCM requires service worker support in browser context)
let messaging = null;
try {
  messaging = getMessaging(app);
} catch (error) {
  console.warn(
    'Firebase Cloud Messaging (FCM) is not supported in this browser context (e.g. private mode, missing service worker registration).',
    error.message
  );
}

export { app, auth, db, storage, messaging };
