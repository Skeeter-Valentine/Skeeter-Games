import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { games as DAILY_GAMES, validateAttempt, transition } from './attempts.js';
import { dailyBoardId, dailyBoardSeconds, recentBoardIds } from './dailyBoard.js';
import { applyEvent, cleanNickname, gauntletDay, gauntletOpensAt, GauntletError, isDay, recordAdvanceRun } from './gauntlet.js';
import { dailyPeppers, gauntletPeppers, gauntletRunPeppers, pepperWeek } from './peppers.js';
import { buildStats, parseAttemptId } from './adminStats.js';

initializeApp();

// Adds peppers to this week's total (pepperWeeks/{week}/players/{uid}). The
// nickname rides along so the public board can show it; players without one
// still collect peppers and appear once they choose a nickname. `at` is the
// moment they count for (an advance gauntlet counts on the day it opens).
function addPeppers(transaction, db, uid, peppers, nickname, at = Date.now()) {
  if (!peppers) return;
  transaction.set(db.doc(`pepperWeeks/${pepperWeek(at)}/players/${uid}`), {
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
    // The owner's advance run (played early, timed in their browser) goes on
    // that day's leaderboard as if played when the day opened.
    if (event.action === 'record') {
      if (!OWNER_UIDS.includes(uid)) throw new HttpsError('permission-denied', 'Only the site owner can record a gauntlet in advance.');
      if (!nickname) throw new HttpsError('failed-precondition', 'Choose a nickname first.');
      if (runSnap.exists && runSnap.get('finishedAt')) return { run: runSnap.data(), entry: null, alreadyRecorded: true, now: Date.now() };
      let recorded;
      try { recorded = recordAdvanceRun(event.day, event.run, Date.now()); }
      catch (error) { throw asHttpsError(error); }
      transaction.set(runRef, { ...recorded.run, uid });
      transaction.set(entryRef, { ...recorded.entry, nickname });
      // Peppers for a gauntlet that hasn't opened yet wait in pendingPeppers
      // until it does (releasePeppers), so the weekly board doesn't give the
      // early run away.
      const opensAt = gauntletOpensAt(event.day), peppers = gauntletRunPeppers(event.day, recorded.run);
      if (opensAt > Date.now()) {
        if (peppers) transaction.set(db.doc(`pendingPeppers/${event.day}_${uid}`), { uid, day: event.day, peppers, at: opensAt });
      } else addPeppers(transaction, db, uid, peppers, nickname, opensAt);
      return { run: recorded.run, entry: recorded.entry, now: Date.now() };
    }
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

// ----- Owner statistics (/admin/stats) -----
// Reads every player record, puzzle attempt, gauntlet run and puzzle total
// and summarises them. Only the site owner may call it. Cost grows with the
// number of attempts (one read each), which is fine at this size.
export const adminStats = onCall({ region: 'us-central1', maxInstances: 2, timeoutSeconds: 300, memory: '1GiB' }, async request => {
  if (!request.auth || !OWNER_UIDS.includes(request.auth.uid)) throw new HttpsError('permission-denied', 'Owner only.');
  try {
    return await readStats();
  } catch (error) {
    // Logged in full, and the reason shown on the stats page.
    console.error('adminStats failed', error);
    throw new HttpsError('internal', `Stats failed: ${error?.message || error}`);
  }
});

async function readStats() {
  const db = getFirestore();
  // Only the fields the summary uses, which keeps memory low as records grow.
  const [groups, runSnap, rateSnap] = await Promise.all([
    db.collectionGroup('players').select('nickname', 'status').get(),
    db.collection('gauntletRuns').select('finishedAt').get(),
    db.collection('puzzleRates').select('game', 'date', 'mode', 'starts', 'wins').get(),
  ]);
  const players = [], attempts = [];
  for (const doc of groups.docs) {
    const parent = doc.ref.parent.parent;
    if (!parent) { players.push({ uid: doc.id, nickname: doc.get('nickname') || null }); continue; }
    if (parent.parent.id !== 'puzzleAttempts') continue;
    const puzzle = parseAttemptId(parent.id);
    if (puzzle) attempts.push({ uid: doc.id, ...puzzle, status: doc.get('status') });
  }
  const runs = runSnap.docs.map(doc => {
    const split = doc.id.indexOf('_');
    return { day: doc.id.slice(0, split), uid: doc.id.slice(split + 1), finished: !!doc.get('finishedAt') };
  }).filter(run => /^\d{4}-\d{2}-\d{2}$/.test(run.day) && !run.day.startsWith('2099'));
  const rates = rateSnap.docs.map(doc => ({ game: doc.get('game'), date: doc.get('date'), mode: doc.get('mode'), starts: doc.get('starts') || 0, wins: doc.get('wins') || 0 }))
    .filter(rate => rate.game && /^\d{4}-\d{2}-\d{2}$/.test(rate.date));
  const stats = buildStats({ players, attempts, runs, rates, today: new Date().toISOString().slice(0, 10) });
  // Everyone with a nickname, plus the 200 most active players without one.
  const named = stats.users.filter(user => user.nickname);
  const unnamed = stats.users.filter(user => !user.nickname);
  return { ...stats, users: [...named, ...unnamed.slice(0, 200)], unnamedTotal: unnamed.length };
}

// Credits peppers held back from advance gauntlet runs once their gauntlet
// opens (4am Colorado time; this runs a minute later). Anything missed, for
// example while the function was being deployed, is picked up the next run.
export async function releaseDuePeppers(db, now = Date.now()) {
  const due = await db.collection('pendingPeppers').where('at', '<=', now).get();
  let released = 0;
  for (const pending of due.docs) {
    await db.runTransaction(async transaction => {
      const snap = await transaction.get(pending.ref);
      if (!snap.exists) return;
      const { uid, peppers, at } = snap.data();
      const player = await transaction.get(db.doc(`players/${uid}`));
      addPeppers(transaction, db, uid, peppers, player.exists ? player.get('nickname') : null, at);
      transaction.delete(pending.ref);
      released += 1;
    });
  }
  return released;
}
export const releasePeppers = onSchedule({ schedule: '1 4 * * *', timeZone: 'America/Denver', region: 'us-central1' },
  async () => { await releaseDuePeppers(getFirestore()); });
