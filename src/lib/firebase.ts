import { initializeApp, getApps, getApp, setLogLevel } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import firebaseConfig from '../../firebase-applet-config.json';

// Reduce noisy internal warnings in console for non-critical fallback states
setLogLevel('error');

const config = {
  ...firebaseConfig,
  databaseURL: (firebaseConfig as any).databaseURL || "https://gen-lang-client-0257718530-default-rtdb.asia-southeast1.firebasedatabase.app",
};

const app = getApps().length === 0 ? initializeApp(config) : getApp();
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || undefined);

let lazyAuth: Auth | null = null;
export const getFirebaseAuth = (): Auth => {
  if (!lazyAuth) {
    lazyAuth = getAuth(app);
  }
  return lazyAuth;
};

// Lazy proxy for auth so getAuth(app) is never called at module load time
export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    const instance = getFirebaseAuth();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

export const rtdb = getDatabase(app);
export default app;
