import { onIdTokenChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseConfigured, firebaseServices } from './firebase.js';

// The EPL pool (/eplpool). Everything is written by the functions
// (functions/eplPool.js, which also has the rules); the site reads its own
// member record, picks and the season's fixtures.
export const SEASON = 2026;
export const PICKS_PER_WEEK = 3;
export const MIN_PER_TEAM = 4;
export const MAX_PER_TEAM = 7;

const call = (name, data) => httpsCallable(getFunctions(undefined, 'us-central1'), name)(data).then(result => result.data);
export const joinPool = code => call('eplJoin', { code });
// `team`: the member whose entry this is (yours if left out, or one you manage).
export const savePicks = (matchday, picks, team = null) => call('eplSavePicks', { matchday, picks, ...(team ? { team } : {}) });
export const poolAdmin = (action, data = {}) => call('eplAdmin', { action, ...data });
export const loadBoard = () => call('eplBoard', {});

// Calls back with { user, member }: user undefined while checking, null when
// signed out; member null when not in the pool (kept up to date).
export function watchPoolMember(callback) {
  if (!firebaseConfigured) { callback({ user: null, member: null }); return () => {}; }
  const { auth, db } = firebaseServices();
  let stop = () => {};
  const stopAuth = onIdTokenChanged(auth, user => {
    stop();
    if (!user || user.isAnonymous) { stop = () => {}; callback({ user: null, member: null }); return; }
    callback({ user, member: undefined });
    stop = onSnapshot(doc(db, 'eplMembers', user.uid),
      snapshot => callback({ user, member: snapshot.exists() ? { uid: user.uid, ...snapshot.data() } : null }),
      () => callback({ user, member: null }));
  });
  return () => { stop(); stopAuth(); };
}

export async function loadSeason() {
  const snapshot = await getDoc(doc(firebaseServices().db, 'eplSeasons', String(SEASON)));
  return snapshot.exists() ? snapshot.data() : { fixtures: [], syncedAt: null };
}
export async function loadPicks(uid) {
  const snapshot = await getDoc(doc(firebaseServices().db, 'eplPicks', uid));
  return snapshot.exists() ? snapshot.data().weeks ?? {} : {};
}
// Other members' teams this player manages: [{ uid, name }].
export async function loadManagedTeams(uid) {
  const snapshot = await getDocs(query(collection(firebaseServices().db, 'eplMembers'), where('managers', 'array-contains', uid)));
  return snapshot.docs.map(entry => ({ uid: entry.id, name: entry.data().name }));
}
// Admins only (the Firestore rules refuse everyone else).
export async function loadMembers() {
  const db = firebaseServices().db;
  const [members, picks, invites] = await Promise.all(['eplMembers', 'eplPicks', 'eplInvites'].map(name => getDocs(collection(db, name))));
  const weeks = Object.fromEntries(picks.docs.map(entry => [entry.id, entry.data().weeks ?? {}]));
  return {
    members: members.docs.map(entry => ({ uid: entry.id, ...entry.data(), weeks: weeks[entry.id] ?? {} })).sort((a, b) => a.name.localeCompare(b.name)),
    invites: invites.docs.map(entry => ({ code: entry.id, ...entry.data() })),
  };
}

// ----- Helpers for the pages -----
const OPEN = ['SCHEDULED', 'TIMED', 'POSTPONED'];
export const isLocked = (fixture, now = Date.now()) => !OPEN.includes(fixture.status) || Date.parse(fixture.utcDate) <= now;
export const matchdays = fixtures => [...new Set(fixtures.map(fixture => fixture.matchday))].sort((a, b) => a - b);
// A game week's picks all lock when its first match kicks off.
export const weekLocked = (fixtures, matchday, now = Date.now()) => fixtures.some(fixture => fixture.matchday === matchday && isLocked(fixture, now));
export const firstKickoff = (fixtures, matchday) => fixtures.filter(fixture => fixture.matchday === matchday).map(fixture => fixture.utcDate).sort()[0];
// The week to show first: the first that hasn't locked yet.
export function currentMatchday(fixtures, now = Date.now()) {
  const open = matchdays(fixtures).filter(day => !weekLocked(fixtures, day, now));
  return open.length ? open[0] : Math.max(0, ...fixtures.map(fixture => fixture.matchday));
}
export function teamsOf(fixtures) {
  const teams = new Map();
  for (const fixture of fixtures) for (const side of [fixture.home, fixture.away]) if (side.id) teams.set(side.id, side);
  return [...teams.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export function teamCounts(weeks) {
  const counts = new Map();
  for (const picks of Object.values(weeks ?? {})) for (const pick of picks) counts.set(pick.team, (counts.get(pick.team) ?? 0) + 1);
  return counts;
}
export const friendlyPoolError = error => error?.message?.replace(/^.*?: /, '') || "That didn't work. Try again.";
