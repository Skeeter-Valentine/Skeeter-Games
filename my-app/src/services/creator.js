import { onIdTokenChanged } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseConfigured, firebaseServices } from './firebase.js';
import { withDay } from '../utils/creatorAccess.js';

// Creator accounts: existing player accounts the owner has made creators (at
// /admin/creators), which can play the gauntlets they're invited to before
// they go live. A creator's record is creators/{uid}:
// { name, email, allDays, days, joinedAt, updatedAt }.

// Calls back with undefined while checking, null when this visitor isn't a
// creator, or their record (kept up to date, so invitations the owner adds or
// removes show up straight away).
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

// ----- Owner only (the function and the Firestore rules refuse everyone else) -----
// Accounts matching a nickname (its start) or a sign-in email:
// [{ uid, nickname, email, name, creator }].
export async function findPlayers(query) {
  const result = await httpsCallable(getFunctions(undefined, 'us-central1'), 'findPlayers')({ query });
  return result.data.players;
}

export async function listCreators() {
  const snapshot = await getDocs(collection(firebaseServices().db, 'creators'));
  return snapshot.docs.map(entry => ({ uid: entry.id, ...entry.data() })).sort((a, b) => (b.joinedAt ?? 0) - (a.joinedAt ?? 0));
}

const accessFields = ({ name, allDays, days }) => ({ name: name.trim().slice(0, 60), allDays: !!allDays, days: allDays ? [] : [...days].sort() });

export const makeCreator = ({ uid, email = null, ...access }) => setDoc(doc(firebaseServices().db, 'creators', uid),
  { ...accessFields(access), email: email || null, joinedAt: Date.now(), updatedAt: Date.now() });

export const updateCreator = (uid, access) => updateDoc(doc(firebaseServices().db, 'creators', uid),
  { ...accessFields(access), updatedAt: Date.now() });

// Invites a creator to one day's gauntlet (or takes the invitation back).
export const inviteToDay = (creator, day, invited = true) => updateDoc(doc(firebaseServices().db, 'creators', creator.uid),
  { days: withDay(creator, day, invited), updatedAt: Date.now() });

export const removeCreator = uid => deleteDoc(doc(firebaseServices().db, 'creators', uid));
