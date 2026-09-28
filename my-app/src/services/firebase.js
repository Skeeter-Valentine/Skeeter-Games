import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const firebaseConfigured = Object.values(config).every(Boolean);
let services;
export function firebaseServices() {
  if (!firebaseConfigured) throw new Error('Account saving is not configured yet.');
  if (!services) {
    const app = getApps()[0] || initializeApp(config);
    services = { auth: getAuth(app), db: getFirestore(app) };
  }
  return services;
}
