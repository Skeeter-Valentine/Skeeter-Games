import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldPath, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { games as DAILY_GAMES, validateAttempt, transition } from './attempts.js';
import { dailyBoardId, dailyBoardSeconds, recentBoardIds } from './dailyBoard.js';
import { applyEvent, cleanNickname, gauntletDay, gauntletOpensAt, GauntletError, isDay, recordAdvanceRun } from './gauntlet.js';
import { dailyPeppers, gauntletPeppers, gauntletRunPeppers, pepperWeek } from './peppers.js';
import { buildStats, parseAttemptId } from './adminStats.js';
import { creatorInvited, featuredCreator, guestFromRun, guestRecord, playerSearch, playerSummary } from './creators.js';
import { dailyHistoryUpdate, gauntletHistoryUpdate, signedIn } from './history.js';
import { EplError, FOOTBALL_DATA_URL, SEASON, buildBoard, checkPicks, cleanName, fixtureFromApi, newInviteCode, resolveImport } from './eplPool.js';

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
      ...(Number.isInteger(data.assists) ? { assists: data.assists } : {}),
    });
    transaction.set(attemptRef, { ...change.attempt, updatedAt: FieldValue.serverTimestamp() });
    // Signed-in players keep their daily results on their account, so streaks
    // follow them to other devices.
    const history = signedIn(request.auth) ? dailyHistoryUpdate(change.attempt) : null;
    if (history) transaction.set(playerRef, history, { merge: true });
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

// Owner only: publishes a custom gauntlet's guest time from its featured
// creator's finished run. gauntletEvent does this when they finish while
// featured; this covers a creator who played before being featured.
export const publishGuest = onCall({ region: 'us-central1', maxInstances: 5 }, async request => {
  const uid = googleUser(request);
  if (!OWNER_UIDS.includes(uid)) throw new HttpsError('permission-denied', 'Only the site owner can publish a guest time.');
  const day = request.data?.day;
  if (!isDay(day)) throw new HttpsError('invalid-argument', 'Unknown gauntlet.');
  const db = getFirestore();
  const customSnap = await db.doc(`customGauntlets/${day}`).get();
  const custom = customSnap.exists ? customSnap.data() : null;
  const runSnap = custom?.creator?.uid ? await db.doc(`gauntletRuns/${day}_${custom.creator.uid}`).get() : null;
  const { guest, reason } = guestFromRun(day, custom, runSnap?.exists ? runSnap.data() : null);
  if (!guest) return { published: false, reason };
  await db.doc(`gauntletGuest/${day}`).set({ ...guest, publishedAt: FieldValue.serverTimestamp() });
  return { published: true, total: guest.total };
});

export const gauntletEvent = onCall({ region: 'us-central1', maxInstances: 20 }, async request => {
  const uid = googleUser(request);
  const event = request.data ?? {};
  if (!isDay(event.day)) throw new HttpsError('invalid-argument', 'Unknown gauntlet.');
  const db = getFirestore();
  const runRef = db.doc(`gauntletRuns/${event.day}_${uid}`);
  const entryRef = db.doc(`gauntletBoard/${event.day}/entries/${uid}`);
  const playerRef = db.doc(`players/${uid}`);
  // A custom gauntlet (made at /admin/gauntlets) replaces that day's lineup.
  const customRef = db.doc(`customGauntlets/${event.day}`);
  return db.runTransaction(async transaction => {
    const [runSnap, playerSnap, customSnap] = await Promise.all([transaction.get(runRef), transaction.get(playerRef), transaction.get(customRef)]);
    const custom = customSnap.exists ? customSnap.data() : null;
    const nickname = playerSnap.exists ? playerSnap.get('nickname') : null;
    if (event.action === 'start' && !runSnap.exists && !nickname) throw new HttpsError('failed-precondition', 'Choose a nickname first.');
    // A custom gauntlet's featured creator: their finished run is published
    // as the day's guest time (gauntletGuest/{day}), under the owner's.
    const featured = featuredCreator(custom, uid);
    const guestRef = db.doc(`gauntletGuest/${event.day}`);
    // An advance run (played early, timed in the browser) by the owner or a
    // creator invited to that day goes on that day's leaderboard as if
    // played when the day opened.
    if (event.action === 'record') {
      const creatorSnap = OWNER_UIDS.includes(uid) ? null : await transaction.get(db.doc(`creators/${uid}`));
      if (creatorSnap && !creatorInvited(creatorSnap.exists ? creatorSnap.data() : null, event.day)) {
        throw new HttpsError('permission-denied', 'Only the site owner and invited creators can record a gauntlet in advance.');
      }
      if (!nickname) throw new HttpsError('failed-precondition', 'Choose a nickname first.');
      if (runSnap.exists && runSnap.get('finishedAt')) return { run: runSnap.data(), entry: null, alreadyRecorded: true, now: Date.now() };
      let recorded;
      try { recorded = recordAdvanceRun(event.day, event.run, Date.now(), custom); }
      catch (error) { throw asHttpsError(error); }
      transaction.set(runRef, { ...recorded.run, uid });
      transaction.set(entryRef, { ...recorded.entry, nickname });
      if (featured) transaction.set(guestRef, { ...guestRecord(event.day, recorded.run, featured, custom), publishedAt: FieldValue.serverTimestamp() });
      const history = gauntletHistoryUpdate(event.day, recorded.run);
      if (history) transaction.set(playerRef, history, { merge: true });
      // Peppers for a gauntlet that hasn't opened yet wait in pendingPeppers
      // until it does (releasePeppers), so the weekly board doesn't give the
      // early run away.
      const opensAt = gauntletOpensAt(event.day), peppers = gauntletRunPeppers(event.day, recorded.run, custom);
      if (opensAt > Date.now()) {
        if (peppers) transaction.set(db.doc(`pendingPeppers/${event.day}_${uid}`), { uid, day: event.day, peppers, at: opensAt });
      } else addPeppers(transaction, db, uid, peppers, nickname, opensAt);
      return { run: recorded.run, entry: recorded.entry, now: Date.now() };
    }
    let outcome;
    try { outcome = applyEvent(runSnap.exists ? runSnap.data() : null, event, Date.now(), custom); }
    catch (error) { throw asHttpsError(error); }
    if (outcome.reset) {
      transaction.delete(runRef);
      transaction.delete(entryRef);
      return { run: null, now: Date.now() };
    }
    if (!outcome.alreadyStarted) transaction.set(runRef, { ...outcome.run, uid });
    if (outcome.entry) transaction.set(entryRef, { ...outcome.entry, nickname: nickname || 'Player' });
    if (outcome.entry && featured) transaction.set(guestRef, { ...guestRecord(event.day, outcome.run, featured, custom), publishedAt: FieldValue.serverTimestamp() });
    // The finished run joins the player's account history (streaks and stats
    // on every device).
    const history = outcome.entry ? gauntletHistoryUpdate(event.day, outcome.run) : null;
    if (history) transaction.set(playerRef, history, { merge: true });
    // Solved gauntlet games earn their chili rating, plus a bonus for finishing.
    if (event.action === 'finish') addPeppers(transaction, db, uid, gauntletPeppers(event.day, outcome.run, !!outcome.entry, custom), nickname);
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

// ----- Creator accounts (/admin/creators) -----
// The owner finds an existing player account by nickname or sign-in email, to
// make it a creator account (creators/{uid}, written by the owner directly).
export const findPlayers = onCall({ region: 'us-central1', maxInstances: 5 }, async request => {
  const uid = googleUser(request);
  if (!OWNER_UIDS.includes(uid)) throw new HttpsError('permission-denied', 'Only the site owner can look up accounts.');
  const search = playerSearch(request.data?.query);
  if (!search) throw new HttpsError('invalid-argument', 'Type at least 2 letters of a nickname, or a full sign-in email.');
  const db = getFirestore(), auth = getAuth();
  let uids = [];
  if (search.email) {
    try { uids = [(await auth.getUserByEmail(search.email)).uid]; }
    catch (error) { if (error?.code !== 'auth/user-not-found') throw error; }
  } else {
    const claims = await db.collection('nicknames').where(FieldPath.documentId(), '>=', search.prefix)
      .where(FieldPath.documentId(), '<', `${search.prefix}\uf8ff`).limit(10).get();
    uids = [...new Set(claims.docs.map(claim => claim.get('uid')).filter(Boolean))];
  }
  const players = await Promise.all(uids.map(async id => {
    const [player, creator, user] = await Promise.all([db.doc(`players/${id}`).get(), db.doc(`creators/${id}`).get(), auth.getUser(id).catch(() => null)]);
    return playerSummary(id, { nickname: player.exists ? player.get('nickname') : null, email: user?.email, name: user?.displayName, creator: creator.exists });
  }));
  return { players };
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

// ----- EPL pool (skeetergames.org/eplpool; rules in eplPool.js) -----
// Signed-in accounts only (not anonymous); members come in by invite.
const eplUser = request => {
  if (!request.auth || request.auth.token?.firebase?.sign_in_provider === 'anonymous') throw new HttpsError('unauthenticated', 'Sign in to use the pool.');
  return request.auth.uid;
};
const eplFail = error => {
  if (error instanceof EplError) throw new HttpsError(error.code, error.message);
  throw error;
};
async function eplMember(db, uid) {
  const snap = await db.doc(`eplMembers/${uid}`).get();
  return snap.exists ? snap.data() : null;
}
async function eplRequireAdmin(db, uid) {
  if (OWNER_UIDS.includes(uid)) return;
  if (!(await eplMember(db, uid))?.admin) throw new HttpsError('permission-denied', 'Only pool admins can do that.');
}
async function eplFixtures(db) {
  const snap = await db.doc(`eplSeasons/${SEASON}`).get();
  return snap.exists ? snap.data().fixtures ?? [] : [];
}

// Downloads the season's fixtures (kickoff times, results) from football-data.org.
async function eplSync(db) {
  const settings = await db.doc('eplPrivate/settings').get();
  const key = settings.exists ? settings.get('footballDataKey') : null;
  if (!key) throw new HttpsError('failed-precondition', 'Add the football-data.org API key on the pool admin page first.');
  const response = await fetch(FOOTBALL_DATA_URL, { headers: { 'X-Auth-Token': key } });
  if (!response.ok) throw new HttpsError('unavailable', `football-data.org answered ${response.status}${response.status === 403 ? ' (check the API key)' : ''}.`);
  const { matches = [] } = await response.json();
  const fixtures = matches.filter(match => Number.isInteger(match.matchday)).map(fixtureFromApi);
  if (!fixtures.length) throw new HttpsError('unavailable', 'football-data.org sent no matches.');
  await db.doc(`eplSeasons/${SEASON}`).set({ season: SEASON, fixtures, syncedAt: FieldValue.serverTimestamp() });
  return fixtures.length;
}
// Every 3 hours, so kickoff changes reach the locks.
export const eplSyncFixtures = onSchedule({ schedule: 'every 3 hours', region: 'us-central1' }, async () => {
  const db = getFirestore();
  const settings = await db.doc('eplPrivate/settings').get();
  if (settings.exists && settings.get('footballDataKey')) await eplSync(db);
});

// Joins the pool with an invite code (the site owner can join without one).
export const eplJoin = onCall({ region: 'us-central1', maxInstances: 5 }, async request => {
  const uid = eplUser(request);
  const db = getFirestore();
  const owner = OWNER_UIDS.includes(uid);
  const code = String(request.data?.code ?? '').trim().toUpperCase();
  const memberRef = db.doc(`eplMembers/${uid}`);
  return db.runTransaction(async transaction => {
    const member = await transaction.get(memberRef);
    if (member.exists) return { joined: true };
    const invite = code ? await transaction.get(db.doc(`eplInvites/${code}`)) : null;
    if (!owner && (!invite?.exists || invite.get('usedBy'))) throw new HttpsError('permission-denied', 'That invite has already been used or does not exist. Ask for a new one.');
    const token = request.auth.token;
    const name = cleanName(invite?.exists ? invite.get('name') : '') || cleanName(token.name) || (token.email || 'Player').split('@')[0];
    transaction.set(memberRef, { name, email: token.email ?? null, admin: owner || !!invite?.get('admin'), managers: [], joinedAt: FieldValue.serverTimestamp() });
    if (invite?.exists) {
      transaction.update(invite.ref, { usedBy: uid, usedAt: FieldValue.serverTimestamp() });
      // Picks imported from the spreadsheet for this player come with the invite.
      const weeks = invite.get('weeks');
      if (weeks && Object.keys(weeks).length) transaction.set(db.doc(`eplPicks/${uid}`), { weeks, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    return { joined: true };
  });
});

// Saves one game week's picks (checked against the locks and season limits).
// `team`: another member's entry this player manages (their own if left out).
export const eplSavePicks = onCall({ region: 'us-central1', maxInstances: 10 }, async request => {
  const uid = eplUser(request);
  const db = getFirestore();
  if (!(await eplMember(db, uid))) throw new HttpsError('permission-denied', 'Join the pool with an invite first.');
  const team = request.data?.team ? String(request.data.team) : uid;
  if (team !== uid && !((await eplMember(db, team))?.managers ?? []).includes(uid)) throw new HttpsError('permission-denied', "You don't manage that team.");
  const fixtures = await eplFixtures(db);
  const picksRef = db.doc(`eplPicks/${team}`);
  return db.runTransaction(async transaction => {
    const snap = await transaction.get(picksRef);
    const weeks = snap.exists ? snap.get('weeks') ?? {} : {};
    let picks;
    try { picks = checkPicks({ fixtures, weeks, matchday: request.data?.matchday, picks: request.data?.picks, now: Date.now() }); }
    catch (error) { eplFail(error); }
    transaction.set(picksRef, { weeks: { ...weeks, [request.data.matchday]: picks }, updatedAt: FieldValue.serverTimestamp() });
    return { picks };
  });
});

// The standings, Survivor and every player's season, for pool members.
// Includes imported players who haven't joined yet (their picks sit on their
// invite). Others' picks show once the whole week has kicked off (admins too).
export const eplBoard = onCall({ region: 'us-central1', maxInstances: 10 }, async request => {
  const uid = eplUser(request);
  const db = getFirestore();
  const me = await eplMember(db, uid);
  const admin = OWNER_UIDS.includes(uid) || !!me?.admin;
  if (!me && !admin) throw new HttpsError('permission-denied', 'Join the pool with an invite first.');
  const [fixtures, members, picks, invites] = await Promise.all([eplFixtures(db), db.collection('eplMembers').get(),
    db.collection('eplPicks').get(), db.collection('eplInvites').get()]);
  const weeksOf = new Map(picks.docs.map(entry => [entry.id, entry.get('weeks') ?? {}]));
  const players = [
    ...members.docs.map(entry => ({ id: entry.id, name: entry.get('name'), weeks: weeksOf.get(entry.id) ?? {} })),
    ...invites.docs.filter(entry => !entry.get('usedBy') && entry.get('weeks')).map(entry => ({ id: `invite-${entry.id}`, name: entry.get('name'), weeks: entry.get('weeks') })),
  ];
  const managed = members.docs.filter(entry => (entry.get('managers') ?? []).includes(uid)).map(entry => entry.id);
  return { me: uid, ...buildBoard({ fixtures, players, now: Date.now(), seeAll: [uid, ...managed] }) };
});

// Pool admin actions.
export const eplAdmin = onCall({ region: 'us-central1', maxInstances: 5 }, async request => {
  const uid = eplUser(request);
  const db = getFirestore();
  await eplRequireAdmin(db, uid);
  const { action } = request.data ?? {};
  if (action === 'createInvite') {
    const code = newInviteCode();
    await db.doc(`eplInvites/${code}`).set({ name: cleanName(request.data.name), admin: !!request.data.admin, createdBy: uid, createdAt: FieldValue.serverTimestamp(), usedBy: null, usedAt: null });
    return { code };
  }
  if (action === 'setInviteAdmin') {
    await db.doc(`eplInvites/${String(request.data.code)}`).update({ admin: !!request.data.admin });
    return {};
  }
  if (action === 'addManager' || action === 'removeManager') {
    // Lets one member make picks for another's team (or stops it).
    const target = db.doc(`eplMembers/${String(request.data.uid)}`);
    const manager = String(request.data.manager);
    if (!(await target.get()).exists || !(await db.doc(`eplMembers/${manager}`).get()).exists) throw new HttpsError('not-found', 'No such member.');
    await target.update({ managers: action === 'addManager' ? FieldValue.arrayUnion(manager) : FieldValue.arrayRemove(manager) });
    return {};
  }
  if (action === 'deleteInvite') {
    await db.doc(`eplInvites/${String(request.data.code)}`).delete();
    return {};
  }
  if (action === 'setAdmin' || action === 'rename') {
    const target = db.doc(`eplMembers/${String(request.data.uid)}`);
    if (!(await target.get()).exists) throw new HttpsError('not-found', 'No such member.');
    await target.update(action === 'setAdmin' ? { admin: !!request.data.admin } : { name: cleanName(request.data.name) || 'Player' });
    return {};
  }
  if (action === 'removeMember') {
    if (String(request.data.uid) === uid) throw new HttpsError('failed-precondition', "You can't remove yourself.");
    await db.doc(`eplMembers/${String(request.data.uid)}`).delete();
    return {};
  }
  if (action === 'setKey') {
    await db.doc('eplPrivate/settings').set({ footballDataKey: String(request.data.key ?? '').trim() }, { merge: true });
    return { count: await eplSync(db) };
  }
  if (action === 'sync') return { count: await eplSync(db) };
  if (action === 'importPlayers') {
    // Players and picks from the pool's spreadsheet: { players: [{ name,
    // weeks: { [matchday]: [team names] } }] }. A member with that name gets
    // the picks; anyone else gets an invite that carries them.
    const fixtures = await eplFixtures(db);
    if (!fixtures.length) throw new HttpsError('failed-precondition', 'Load the fixtures first.');
    const players = Array.isArray(request.data.players) ? request.data.players.slice(0, 200) : [];
    const [members, invites] = await Promise.all([db.collection('eplMembers').get(), db.collection('eplInvites').get()]);
    const same = (a, b) => cleanName(a).toLowerCase() === cleanName(b).toLowerCase();
    const problems = [];
    let updated = 0, created = 0;
    for (const player of players) {
      const name = cleanName(player.name);
      if (!name) continue;
      const { weeks, problems: found } = resolveImport(fixtures, player.weeks);
      problems.push(...found.map(problem => `${name}: ${problem}`));
      const member = members.docs.find(entry => same(entry.get('name'), name));
      if (member) {
        const ref = db.doc(`eplPicks/${member.id}`);
        const old = (await ref.get()).get('weeks') ?? {};
        await ref.set({ weeks: { ...old, ...weeks }, updatedAt: FieldValue.serverTimestamp() });
        updated++;
        continue;
      }
      const invite = invites.docs.find(entry => !entry.get('usedBy') && same(entry.get('name'), name));
      if (invite) { await invite.ref.update({ weeks }); updated++; continue; }
      await db.doc(`eplInvites/${newInviteCode()}`).set({ name, weeks, createdBy: uid, createdAt: FieldValue.serverTimestamp(), usedBy: null, usedAt: null });
      created++;
    }
    return { updated, created, problems };
  }
  if (action === 'setPicks') {
    // Entering or fixing a team's picks: no lock or season limits. `uid` for
    // a member, or `invite` for a player who hasn't joined yet (their picks
    // stay on the invite and come with them when they join).
    const fixtures = await eplFixtures(db);
    const invite = request.data.invite ? db.doc(`eplInvites/${String(request.data.invite)}`) : null;
    const ref = invite ?? db.doc(`eplPicks/${String(request.data.uid)}`);
    const snap = await ref.get();
    if (invite && (!snap.exists || snap.get('usedBy'))) throw new HttpsError('not-found', 'That player has joined since; reload the page.');
    const weeks = snap.exists ? snap.get('weeks') ?? {} : {};
    let picks;
    try { picks = checkPicks({ fixtures, weeks, matchday: request.data.matchday, picks: request.data.picks, now: Date.now(), admin: true }); }
    catch (error) { eplFail(error); }
    const update = { weeks: { ...weeks, [request.data.matchday]: picks } };
    if (invite) await ref.update(update);
    else await ref.set({ ...update, updatedAt: FieldValue.serverTimestamp() });
    return { picks };
  }
  throw new HttpsError('invalid-argument', 'Unknown pool action.');
});
