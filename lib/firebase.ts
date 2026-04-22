import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, 
  getRedirectResult, signOut, onAuthStateChanged, User 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const initializeFirebase = () => {
  try {
    if (!firebaseConfig || !firebaseConfig.apiKey) {
      console.error('Firebase config is missing or invalid. Check firebase-applet-config.json');
      // Return a mock or throw if critical, but mock allows the hook to at least unblock
    }
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    return { auth, db };
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    throw error;
  }
};

const { auth, db } = initializeFirebase();
export { auth, db };
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google', error);
    throw error;
  }
};

export const signInWithGoogleRedirect = () => signInWithRedirect(auth, googleProvider);
export const getGoogleRedirectResult = () => getRedirectResult(auth);

export const logout = () => signOut(auth);

export { onAuthStateChanged };
export type { User };
