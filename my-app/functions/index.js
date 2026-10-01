import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { validateAttempt, transition } from './attempts.js';

initializeApp();
export const recordPuzzleAttempt = onCall({ region: 'us-central1', maxInstances: 10 }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in required');
  let data;
  try { data = validateAttempt(request.data, new Date().toISOString().slice(0, 10)); }
  catch { throw new HttpsError('invalid-argument', 'Invalid puzzle attempt'); }
  const db = getFirestore();
  const id = `${data.version}_${data.game}_${data.date}_${data.mode}`;
  const attemptRef = db.doc(`puzzleAttempts/${id}/players/${request.auth.uid}`);
  const aggregateRef = db.doc(`puzzleRates/${id}`);
  await db.runTransaction(async transaction => {
    const previous = await transaction.get(attemptRef);
    const change = transition(previous.exists ? previous.data() : null, data);
    if (!change) return;
    transaction.set(attemptRef, { ...change.attempt, updatedAt: FieldValue.serverTimestamp() });
    transaction.set(aggregateRef, {
      version: data.version, game: data.game, date: data.date, mode: data.mode,
      starts: FieldValue.increment(change.starts), wins: FieldValue.increment(change.wins), losses: FieldValue.increment(change.losses),
      timedWins: FieldValue.increment(change.timedWins), winSeconds: FieldValue.increment(change.winSeconds),
      ...(change.bucket ? { timeBuckets: { [change.bucket]: FieldValue.increment(1) } } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  return { recorded: true };
});
