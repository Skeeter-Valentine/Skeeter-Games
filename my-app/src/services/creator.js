import { onIdTokenChanged } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseConfigured, firebaseServices } from './firebase.js';
import { newInviteCode } from '../utils/creatorAccess.js';

// Creator accounts (invite only): see functions/creators.js. A creator's
// record is creators/{uid}: { name, email, allDays, days, joinedAt }.

// Calls back with undefined while checking, null when this visitor isn't a
// creator, or their record (kept up to date, so access the owner adds or
// removes shows up straight away).
export function watchCreator(callback) {
  if (!firebaseConfigured) { callback(null); return () => {}; }
  const { auth, db } = firebaseServices();
  let stopRecord = () => {};
  const stopAuth = onIdTokenChanged(auth, user => {
    stopRecord();
    if (!user || user.isAnonymous) { stopRecord = () => {}; callback(null); return; }
    callback(undefined);
    stopRecord = onSnapshot(doc(db, 'creators', user.uid),
      snapshot => callback(snapshot.exists() ? { uid: user.uid, ...snapshot.data() } : null),
      () => callback(null));
  });
  return () => { stopRecord(); stopAuth(); };
}

export async function redeemCreatorInvite(code) {
  const result = await httpsCallable(getFunctions(undefined, 'us-central1'), 'redeemCreatorInvite')({ code });
  return result.data.creator;
}

// ----- Owner only (the Firestore rules refuse everyone else) -----
export async function listCreators() {
  const snapshot = await getDocs(collection(firebaseServices().db, 'creators'));
  return snapshot.docs.map(entry => ({ uid: entry.id, ...entry.data() })).sort((a, b) => (b.joinedAt ?? 0) - (a.joinedAt ?? 0));
}

export async function listInvites() {
  const snapshot = await getDocs(collection(firebaseServices().db, 'creatorInvites'));
  return snapshot.docs.map(entry => ({ code: entry.id, ...entry.data() })).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function createInvite({ name, allDays, days }) {
  const code = newInviteCode();
  const invite = { name: name.trim().slice(0, 60), allDays: !!allDays, days: allDays ? [] : [...days].sort(), createdAt: Date.now(), usedBy: null };
  await setDoc(doc(firebaseServices().db, 'creatorInvites', code), invite);
  return { code, ...invite };
}

export const deleteInvite = code => deleteDoc(doc(firebaseServices().db, 'creatorInvites', code));

export const updateCreator = (uid, { name, allDays, days }) => updateDoc(doc(firebaseServices().db, 'creators', uid),
  { name: name.trim().slice(0, 60), allDays: !!allDays, days: allDays ? [] : [...days].sort(), updatedAt: Date.now() });

export const removeCreator = uid => deleteDoc(doc(firebaseServices().db, 'creators', uid));

export const inviteLink = code => `${window.location.origin}/creator?invite=${code}`;
