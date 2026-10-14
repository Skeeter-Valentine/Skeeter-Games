import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { games as DAILY_GAMES, validateAttempt, transition } from './attempts.js';
import { dailyBoardId, dailyBoardSeconds, recentBoardIds } from './dailyBoard.js';
import { applyEvent, cleanNickname, gauntletDay, GauntletError, isDay } from './gauntlet.js';
import { dailyPeppers, gauntletPeppers, pepperWeek } from './peppers.js';

initializeApp();

// Adds peppers to this week's total (pepperWeeks/{week}/players/{uid}). The
// nickname rides along so the public board can show it; players without one
// still collect peppers and appear once they choose a nickname.
function addPeppers(transaction, db, uid, peppers, nickname) {
  if (!peppers) return;
  transaction.set(db.doc(`pepperWeeks/${pepperWeek(Date.now())}/players/${uid}`), {
    peppers: FieldValue.increment(peppers), nickname: nickname || null, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export const recordPuzzleAttempt = onCall({ region: 'us-central1', maxInstances: 10 }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in required');
  let data;
  try { data = validateAttempt(request.data, new Date().toISOString().slice(0, 10)); }
  catch { throw new HttpsError('invalid-argument', 'Invalid puzzle attempt'); }
  const db = getFirestore();
  const id = `${data.version}_${data.game}_${data.date}_${data.mode}`;
  const attemptRef = db.doc(`puzzleAttempts/${id}/players/${request.auth.uid}`);
  const aggregateRef = db.doc(`puzzleRates/${id}`);
  const playerRef = db.doc(`players/${request.auth.uid}`);
  await db.runTransaction(async transaction => {
    const [previous, player] = await Promise.all([transaction.get(attemptRef), transaction.get(playerRef)]);
    const change = transition(previous.exists ? previous.data() : null, data);
    if (!change) return;
    const nickname = player.exists ? player.get('nickname') : null;
    // Solving today's daily puzzle earns its chili rating in peppers...
    addPeppers(transaction, db, request.auth.uid, dailyPeppers(data, change.wins === 1, Date.now()), nickname);
    // ...and puts the solve time on that puzzle's fastest-times board.
    const boardSeconds = dailyBoardSeconds(data, change.wins === 1, Date.now());
    if (boardSeconds !== null) transaction.set(db.doc(`dailyBoard/${dailyBoardId(data.game, data.date)}/entries/${request.auth.uid}`), {
      seconds: boardSeconds, nickname: nickname || null, finishedAt: FieldValue.serverTimestamp(),
    });
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

// ----- Skeeter Gauntlet leaderboard -----
// Runs are timed here, on the server clock: the browser only says "start",
// "next" and "finish". A run lives at gauntletRuns/{day}_{uid} (readable only
// by its player); finishing writes the public gauntletBoard/{day}/entries/{uid}.
function googleUser(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to play for the leaderboard.');
  if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') throw new HttpsError('unauthenticated', 'Sign in to play for the leaderboard.');
  return request.auth.uid;
}
// The site owner (same account as the gauntletPar rule) may use "Skeeter".
const OWNER_UIDS = ['QtQwYuCN4vWR1XNyz9K6fe9G7jl1'];
const asHttpsError = error => error instanceof GauntletError ? new HttpsError(error.code, error.message) : error;

export const gauntletEvent = onCall({ region: 'us-central1', maxInstances: 20 }, async request => {
  const uid = googleUser(request);
  const event = request.data ?? {};
  if (!isDay(event.day)) throw new HttpsError('invalid-argument', 'Unknown gauntlet.');
  const db = getFirestore();
  const runRef = db.doc(`gauntletRuns/${event.day}_${uid}`);
  const entryRef = db.doc(`gauntletBoard/${event.day}/entries/${uid}`);
  const playerRef = db.doc(`players/${uid}`);
  return db.runTransaction(async transaction => {
    const [runSnap, playerSnap] = await Promise.all([transaction.get(runRef), transaction.get(playerRef)]);
    const nickname = playerSnap.exists ? playerSnap.get('nickname') : null;
    if (event.action === 'start' && !runSnap.exists && !nickname) throw new HttpsError('failed-precondition', 'Choose a nickname first.');
    let outcome;
    try { outcome = applyEvent(runSnap.exists ? runSnap.data() : null, event, Date.now()); }
    catch (error) { throw asHttpsError(error); }
    if (outcome.reset) {
      transaction.delete(runRef);
      transaction.delete(entryRef);
      return { run: null, now: Date.now() };
    }
    if (!outcome.alreadyStarted) transaction.set(runRef, { ...outcome.run, uid });
    if (outcome.entry) transaction.set(entryRef, { ...outcome.entry, nickname: nickname || 'Player' });
    // Solved gauntlet games earn their chili rating, plus a bonus for finishing.
    if (event.action === 'finish') addPeppers(transaction, db, uid, gauntletPeppers(event.day, outcome.run, !!outcome.entry), nickname);
    return { run: outcome.run, entry: outcome.entry ?? null, alreadyStarted: !!outcome.alreadyStarted, now: Date.now() };
  });
});

// Nicknames are unique ignoring case: nicknames/{key} -> { uid } claims one.
export const setNickname = onCall({ region: 'us-central1', maxInstances: 10 }, async request => {
  const uid = googleUser(request);
  let cleaned;
  try { cleaned = cleanNickname(request.data?.nickname, { owner: OWNER_UIDS.includes(uid) }); }
  catch (error) { throw asHttpsError(error); }
  const db = getFirestore();
  const playerRef = db.doc(`players/${uid}`);
  const claimRef = db.doc(`nicknames/${cleaned.key}`);
  const todayEntryRef = db.doc(`gauntletBoard/${gauntletDay(Date.now())}/entries/${uid}`);
  const weekRef = db.doc(`pepperWeeks/${pepperWeek(Date.now())}/players/${uid}`);
  await db.runTransaction(async transaction => {
    const [playerSnap, claimSnap, entrySnap, weekSnap] = await Promise.all([transaction.get(playerRef), transaction.get(claimRef), transaction.get(todayEntryRef), transaction.get(weekRef)]);
    if (claimSnap.exists && claimSnap.get('uid') !== uid) throw new HttpsError('already-exists', 'That nickname is taken.');
    const oldKey = playerSnap.exists ? playerSnap.get('key') : null;
    if (oldKey && oldKey !== cleaned.key) transaction.delete(db.doc(`nicknames/${oldKey}`));
    transaction.set(claimRef, { uid });
    transaction.set(playerRef, { nickname: cleaned.nickname, key: cleaned.key, updatedAt: FieldValue.serverTimestamp() });
    // Today's board shows the new name straight away.
    if (entrySnap.exists) transaction.update(todayEntryRef, { nickname: cleaned.nickname });
    if (weekSnap.exists) transaction.update(weekRef, { nickname: cleaned.nickname });
  });
  // Show the new name on today's and yesterday's fastest-times boards too.
  const boardRefs = recentBoardIds(DAILY_GAMES, Date.now()).map(id => db.doc(`dailyBoard/${id}/entries/${uid}`));
  const boardSnaps = await db.getAll(...boardRefs);
  const batch = db.batch();
  boardSnaps.forEach(snap => { if (snap.exists) batch.update(snap.ref, { nickname: cleaned.nickname }); });
  await batch.commit();
  return { nickname: cleaned.nickname };
});
