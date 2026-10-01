import { signInAnonymously } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, doc, getDocFromServer, getDocsFromServer, query, where } from 'firebase/firestore';
import { firebaseConfigured, firebaseServices } from './firebase.js';
import { readLocal, writeLocal } from '../utils/dailyStats.js';

// Enable only after deploying the function/rules and enabling anonymous auth.
export const puzzleLoggingEnabled = firebaseConfigured && import.meta.env.VITE_PUZZLE_RESULTS_ENABLED === 'true';
export const puzzleResultId = (game, date, mode) => `v1_${game}_${date}_${mode}`;
let signingIn;
export async function readPuzzleRate(game, date, mode) {
  if (!puzzleLoggingEnabled) throw new Error('Community results are not enabled');
  const { db } = firebaseServices();
  const result = await getDocFromServer(doc(db, 'puzzleRates', puzzleResultId(game, date, mode)));
  return result.exists() ? result.data() : null;
}

// Every daily and archive counter document for one game (used by the hidden
// admin archive). puzzleRates is publicly readable, so no special access is needed.
export async function readGameRates(game) {
  if (!puzzleLoggingEnabled) throw new Error('Community results are not enabled');
  const { db } = firebaseServices();
  const result = await getDocsFromServer(query(collection(db, 'puzzleRates'), where('game', '==', game)));
  return result.docs.map(item => item.data());
}

export async function sendPuzzleResult(game, date, mode, status, seconds) {
  const key = `skeeter:pending-result:${puzzleResultId(game, date, mode)}`;
  const previous = readLocal(key, null);
  const payload = previous && previous.status !== 'started' ? previous : {
    version: 'v1', game, date, mode, status,
    seconds: typeof seconds === 'number' && Number.isFinite(seconds) ? Math.min(31536000, Math.max(0, Math.floor(seconds))) : null,
  };
  writeLocal(key, payload);
  if (!puzzleLoggingEnabled) return false;
  const { auth } = firebaseServices();
  await auth.authStateReady();
  if (!auth.currentUser) {
    if (!signingIn) signingIn = signInAnonymously(auth).finally(() => { signingIn = null; });
    await signingIn;
  }
  await httpsCallable(getFunctions(undefined, 'us-central1'), 'recordPuzzleAttempt')(payload);
  // Keep the first result as a local deduplication/outbox record. The server
  // also deduplicates transactionally by authenticated player and puzzle.
  return true;
}
