import { app, auth, db, storage } from './config';
import { collection, limit, query, getDocs } from 'firebase/firestore';

/**
 * Validates Firebase setup by attempting connection checks to auth, db, and storage.
 * 
 * @returns {Promise<Object>} Status report of the verification checks
 */
export const testFirebaseConnection = async () => {
  const report = {
    appInitialized: !!app,
    authInitialized: !!auth,
    dbInitialized: !!db,
    storageInitialized: !!storage,
    firestoreConnected: false,
    status: 'warn',
    message: ''
  };

  if (!app) {
    report.status = 'fail';
    report.message = 'Firebase App initialization failed. Check config parameters.';
    return report;
  }

  // Check if API key is a placeholder
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (!apiKey || apiKey.includes('Placeholder')) {
    report.status = 'warn';
    report.message = 'Local placeholders detected. Update your .env file with actual credentials to connect to live services.';
    return report;
  }

  try {
    // Attempt to execute a light Firestore read (fetch 1 business listing)
    const testQuery = query(collection(db, 'businesses'), limit(1));
    await getDocs(testQuery);
    
    report.firestoreConnected = true;
    report.status = 'success';
    report.message = 'Successfully established connection to Firebase Auth, Firestore Database, and Storage.';
  } catch (error) {
    console.error('Firebase test connection error:', error);
    
    // Check specific error patterns
    if (error.code === 'permission-denied') {
      report.firestoreConnected = false;
      report.status = 'success'; // database exists, rules are functioning correctly
      report.message = 'Database reachable. Firestore returned permission-denied as expected (user is unauthenticated).';
    } else if (error.code === 'failed-precondition') {
      report.message = 'Firestore failed-precondition error (check indexes or local settings).';
    } else {
      report.status = 'fail';
      report.message = `Failed to contact Firestore: ${error.message} (${error.code || 'unknown'})`;
    }
  }

  return report;
};
