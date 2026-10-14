import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseConfigured, firebaseServices } from './firebase.js';
import { parRecord } from '../gauntlet/gauntlet.js';

// The site owner's daily Skeeter Gauntlet time, published so everyone can try
// to beat it. Stored at gauntletPar/{day}: anyone can read it, and the
// Firestore rules only let the owner's Google account write it.
const OWNER_UIDS = (import.meta.env.VITE_ADMIN_UIDS || '').split(',').map(id => id.trim()).filter(Boolean);
export const parEnabled = firebaseConfigured;

export async function readPar(day) {
  if (!parEnabled) return null;
  const snapshot = await getDoc(doc(firebaseServices().db, 'gauntletPar', day));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function publishPar(run) {
  const record = parRecord(run);
  await setDoc(doc(firebaseServices().db, 'gauntletPar', run.date), { ...record, publishedAt: serverTimestamp() });
  return record;
}

// Calls back with true while the owner is signed in with Google (sign in on
// the hidden /admin/archive page; the sign-in carries over to this page).
export function watchOwner(callback) {
  if (!parEnabled || !OWNER_UIDS.length) { callback(false); return () => {}; }
  return onAuthStateChanged(firebaseServices().auth, user => callback(!!user && !user.isAnonymous && OWNER_UIDS.includes(user.uid)));
}
