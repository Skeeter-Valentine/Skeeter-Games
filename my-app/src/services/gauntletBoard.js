import { EmailAuthProvider, FacebookAuthProvider, GithubAuthProvider, GoogleAuthProvider, OAuthProvider, createUserWithEmailAndPassword, linkWithCredential, linkWithPopup,
  onIdTokenChanged, sendEmailVerification, sendPasswordResetEmail, signInWithCredential, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseConfigured, firebaseServices } from './firebase.js';

// Skeeter Gauntlet leaderboard. Turn it on with VITE_GAUNTLET_BOARD_ENABLED=true
// once the gauntletEvent/setNickname functions and Firestore rules are deployed.
// Runs are timed by the server: this page only sends start/next/finish events.
export const boardEnabled = firebaseConfigured && import.meta.env.VITE_GAUNTLET_BOARD_ENABLED === 'true';
export const BOARD_SIZE = 50;

const callable = name => httpsCallable(getFunctions(undefined, 'us-central1'), name);
const RETRY_CODES = ['functions/unavailable', 'functions/deadline-exceeded', 'functions/internal', 'unavailable'];
async function call(name, data, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try { return (await callable(name)(data)).data; }
    catch (error) {
      if (attempt >= tries || !RETRY_CODES.includes(error?.code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 600 * attempt));
    }
  }
}

// Google sign-in works wherever Firebase is configured (the homepage account
// button); nicknames come with the leaderboard.
export const accountsEnabled = firebaseConfigured;

// Calls back with null (signed out or anonymous) or { uid, nickname, name, photo }.
// Uses onIdTokenChanged, which (unlike onAuthStateChanged) also fires when an
// anonymous account is upgraded in place by linking a sign-in method.
export function watchPlayer(callback) {
  if (!accountsEnabled) { callback(null); return () => {}; }
  const { auth, db } = firebaseServices();
  let latest = 0;
  const update = async () => {
    const user = auth.currentUser;
    const mine = ++latest;
    if (!user || user.isAnonymous) { callback(null); return; }
    let nickname = null;
    if (boardEnabled) try { const snapshot = await getDoc(doc(db, 'players', user.uid)); nickname = snapshot.exists() ? snapshot.data().nickname : null; }
    catch { /* first visit or offline: ask for a nickname */ }
    if (mine === latest) callback({ uid: user.uid, nickname, name: user.displayName || '', photo: user.photoURL || '', email: user.email || '' });
  };
  accountListeners.add(update);
  const stop = onIdTokenChanged(auth, update);
  return () => { accountListeners.delete(update); stop(); };
}

const accountListeners = new Set();

// ----- Sign-in options -----
// Which buttons the sign-in box shows, from VITE_AUTH_PROVIDERS (comma
// separated, in order). Each one must also be turned on in Firebase
// Authentication > Sign-in method. Default: Google and email.
export const PROVIDERS = {
  google: { label: 'Google', make: () => new GoogleAuthProvider() },
  apple: { label: 'Apple', make: () => withScopes(new OAuthProvider('apple.com'), ['email', 'name']) },
  microsoft: { label: 'Microsoft', make: () => withParams(new OAuthProvider('microsoft.com'), { prompt: 'select_account' }) },
  facebook: { label: 'Facebook', make: () => new FacebookAuthProvider() },
  github: { label: 'GitHub', make: () => new GithubAuthProvider() },
  email: { label: 'Email' },
};
function withScopes(provider, scopes) { scopes.forEach(scope => provider.addScope(scope)); return provider; }
function withParams(provider, params) { provider.setCustomParameters(params); return provider; }
export const authProviders = (import.meta.env.VITE_AUTH_PROVIDERS || 'google,email')
  .split(',').map(id => id.trim().toLowerCase()).filter(id => PROVIDERS[id]);
const credentialFromError = error => GoogleAuthProvider.credentialFromError(error) || OAuthProvider.credentialFromError(error)
  || FacebookAuthProvider.credentialFromError(error) || GithubAuthProvider.credentialFromError(error);

// Upgrades the anonymous account (used for community stats) when possible, so
// nothing is lost; if that account already exists, signs in to it instead.
export async function signInWithProvider(id) {
  const { auth } = firebaseServices();
  const provider = PROVIDERS[id].make();
  if (auth.currentUser?.isAnonymous) {
    try { const result = await linkWithPopup(auth.currentUser, provider); notifyAccountChange(); return result; }
    catch (error) {
      if (error?.code !== 'auth/credential-already-in-use') throw error;
      // Reuse the sign-in from the popup rather than opening another.
      const credential = credentialFromError(error);
      if (credential) return signInWithCredential(auth, credential);
    }
  }
  return signInWithPopup(auth, provider);
}
export const signInWithGoogle = () => signInWithProvider('google');

export async function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(firebaseServices().auth, email.trim(), password);
}
export async function createEmailAccount(email, password) {
  const { auth } = firebaseServices();
  const credential = EmailAuthProvider.credential(email.trim(), password);
  const result = auth.currentUser?.isAnonymous ? await linkWithCredential(auth.currentUser, credential)
    : await createUserWithEmailAndPassword(auth, email.trim(), password);
  sendEmailVerification(result.user).catch(() => {});
  // Linking keeps the same user, so tell listeners it is no longer anonymous.
  await result.user.reload().catch(() => {});
  notifyAccountChange();
  return result;
}
export const sendPasswordReset = email => sendPasswordResetEmail(firebaseServices().auth, email.trim());

// Belt and braces for in-place upgrades of an anonymous account.
function notifyAccountChange() { accountListeners.forEach(listener => listener()); }
export const signOutPlayer = () => signOut(firebaseServices().auth);

export const saveNickname = nickname => call('setNickname', { nickname }, 2);
// { action: 'start' | 'next' | 'finish' | 'reset', day, game?, status?, penalty? }
export const sendEvent = event => call('gauntletEvent', event);

// This player's server run for a day, if they started one (on any device).
export async function readMyRun(day, uid) {
  const snapshot = await getDoc(doc(firebaseServices().db, 'gauntletRuns', `${day}_${uid}`));
  return snapshot.exists() ? snapshot.data() : null;
}

const entries = day => collection(firebaseServices().db, 'gauntletBoard', day, 'entries');
// Best first: more games solved, then the faster total (one score field).
export async function readBoard(day, size = BOARD_SIZE) {
  const snapshot = await getDocs(query(entries(day), orderBy('score'), limit(size)));
  return snapshot.docs.map(item => ({ uid: item.id, ...item.data() }));
}
export async function readMyEntry(day, uid) {
  const snapshot = await getDoc(doc(firebaseServices().db, 'gauntletBoard', day, 'entries', uid));
  return snapshot.exists() ? { uid, ...snapshot.data() } : null;
}
// Where a score sits on the day's board, and how many players finished.
export async function boardStanding(day, score) {
  const [ahead, everyone] = await Promise.all([getCountFromServer(query(entries(day), where('score', '<', score))), getCountFromServer(entries(day))]);
  return { rank: ahead.data().count + 1, players: everyone.data().count };
}

export function friendlyError(error) {
  if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') return '';
  if (error?.code === 'auth/popup-blocked') return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';
  const messages = {
    'auth/unauthorized-domain': 'Sign-in is not set up for this web address yet.',
    'auth/operation-not-allowed': 'That sign-in option is not available yet. Try another one.',
    'auth/account-exists-with-different-credential': 'You already have an account with that email using a different sign-in option. Sign in that way instead.',
    'auth/credential-already-in-use': 'That account is already linked to another Skeeter Games player.',
    'auth/email-already-in-use': 'There is already an account with that email. Sign in instead.',
    'auth/invalid-credential': 'That email and password don\'t match. Try again or reset your password.',
    'auth/wrong-password': 'That email and password don\'t match. Try again or reset your password.',
    'auth/user-not-found': 'That email and password don\'t match. Try again or reset your password.',
    'auth/invalid-email': 'That doesn\'t look like an email address.',
    'auth/missing-password': 'Enter a password.',
    'auth/weak-password': 'Use a password of at least 6 characters.',
    'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
    'auth/network-request-failed': 'You seem to be offline. Check your connection and try again.',
  };
  if (messages[error?.code]) return messages[error.code];
  if (/unavailable|network-request-failed|deadline-exceeded/.test(error?.code ?? '')) return 'you seem to be offline';
  const message = error?.message?.replace(/^Firebase:\s*/, '');
  return message && !/^internal$/i.test(message) ? message : 'Something went wrong. Try again.';
}
