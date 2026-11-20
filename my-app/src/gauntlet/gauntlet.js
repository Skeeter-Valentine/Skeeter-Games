// Skeeter Gauntlet rules. Pure functions (no React, no storage) so they can be
// unit tested; the page in src/pages/Gauntlet.jsx wires them to the UI.
import { dailyDifficulty } from '../utils/dailyDifficulty.js';
import { LEVELS, PUZZLE_DAY_OFFSET, WORD_GAMES, gamePuzzles, levelChoices, lineupFor } from './weeklyLineup.js';

// The first public gauntlet day, or null while the gauntlet is unlaunched
// (the page then shows "Coming soon"; test gauntlets still work).
export const GAUNTLET_START = '2026-10-13';
export const gauntletLaunched = day => !!GAUNTLET_START && day >= GAUNTLET_START;
export const GAUNTLET_SIZE = 6;
// v2: gauntlet days run from 4am Mountain Time (v1 used midnight UTC).
export const STORAGE_PREFIX = 'skeeter:gauntlet:v2:';
// The site owner's published time, shown to everyone as the one to beat.
export const PAR_NAME = 'Skeeter';

// A new gauntlet opens every day at 4am in Denver (MDT or MST, following
// daylight saving). The "gauntlet day" is the Denver date 4 hours earlier.
export const GAUNTLET_TIME_ZONE = 'America/Denver';
export const RESET_HOUR = 4;
const HOUR = 3600000;
const partsFormat = new Intl.DateTimeFormat('en-US', { timeZone: GAUNTLET_TIME_ZONE, hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
export function gauntletDay(now = Date.now()) {
  // Read the Denver wall clock directly, so daylight-saving changeover nights still reset at 4am local time.
  const parts = Object.fromEntries(partsFormat.formatToParts(new Date(now)).map(part => [part.type, Number(part.value)]));
  const date = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  return parts.hour < RESET_HOUR ? addDays(date, -1) : date;
}
// Minutes the Denver clock is behind UTC at an instant (420 in MST, 360 in MDT).
function denverOffsetMinutes(instant) {
  const parts = Object.fromEntries(partsFormat.formatToParts(new Date(instant)).map(part => [part.type, Number(part.value)]));
  return Math.round((Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant) / -60000);
}
// The instant a gauntlet day opens: 4am Denver time on that date.
export function gauntletOpensAt(day) {
  const localAsUtc = Date.parse(`${day}T0${RESET_HOUR}:00:00Z`);
  let instant = localAsUtc + denverOffsetMinutes(localAsUtc + 7 * HOUR) * 60000;
  instant = localAsUtc + denverOffsetMinutes(instant) * 60000;
  return instant;
}
export const nextGauntletAt = day => gauntletOpensAt(addDays(day, 1));

// Every game that has been in a gauntlet (weeklyLineup.js decides which play
// each week; from 2026-11-09 Add 'em Up replaces Mineskeeter, which stays here
// for older runs). Titles are what players see.
export const GAUNTLET_GAMES = [
  { id: 'akari', title: 'Skeeluminate' },
  { id: 'skeedle-beadle', title: 'Skeedle Beadle' },
  { id: 'map', title: 'Cartograskeet' },
  { id: 'parshle', title: 'Parshle' },
  { id: 'stitches', title: 'Skitches' },
  { id: 'nonograms', title: 'Skeedograms' },
  { id: 'skeedlemath', title: 'Skeedle+' },
  { id: 'pipes', title: 'Skeeter Piper' },
  { id: 'shikaku', title: 'Skeekaku' },
  { id: 'quordle', title: 'Ske4dle' },
  { id: 'word500', title: 'Skeedle500' },
  { id: 'minesweeper', title: 'Mineskeeter' },
  { id: 'hashi', title: 'Hashkeet' },
  { id: 'pepper-placer', title: 'Pepper Placer' },
  { id: 'kakurasu', title: 'Add ’em Up' },
];
export const gameTitle = id => GAUNTLET_GAMES.find(game => game.id === id)?.title ?? id;

// Gauntlet puzzles come from a date this many days after the real one. That
// date is never a daily puzzle and can never be opened from the archive (the
// archive only allows past dates), so gauntlet puzzles, saved progress and
// results never mix with the dailies. 20,000 days is about 55 years.
// Pepper leaderboard weeks start Monday at 4am Colorado time (the Monday's
// date names the week). functions/peppers.js uses the same rule.
export function pepperWeek(now = Date.now()) {
  const day = gauntletDay(now);
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return new Date(Date.parse(`${day}T00:00:00Z`) - ((weekday + 6) % 7) * 86400000).toISOString().slice(0, 10);
}

export { PUZZLE_DAY_OFFSET };
const DAY = 86400000;
const isDate = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
  && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
export const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
export function gauntletPuzzleDate(date) {
  if (!isDate(date)) throw new RangeError('Expected a valid YYYY-MM-DD date');
  return addDays(date, PUZZLE_DAY_OFFSET);
}

// Test gauntlets (/gauntlet?test=1, 2, 3...): replayable runs on their own
// "days" in 2099, so they never touch a real day's attempt or history. The
// first three have fixed lineups that between them cover every game.
export const TEST_GAUNTLETS = 9;
export const testDay = number => addDays('2099-01-01', number - 1);
export const isTestDay = day => typeof day === 'string' && day.startsWith('2099-');
const FIXED_LINEUPS = {
  '2099-01-01': ['akari', 'skeedle-beadle', 'map', 'parshle', 'stitches', 'nonograms'],
  '2099-01-02': ['skeedlemath', 'pipes', 'shikaku', 'quordle', 'word500', 'minesweeper'],
  '2099-01-03': ['hashi', 'kakurasu', 'word500', 'stitches', 'akari', 'pepper-placer'],
};

// Word games: every gauntlet has exactly two of these.
export { WORD_GAMES, LEVELS, levelChoices };

// ----- Custom gauntlets -----
// The owner can replace a day's lineup with six games of their choice and give
// that day its own name (e.g. a creator's), from /admin/gauntlets. They're
// stored at customGauntlets/{day} and loaded before a gauntlet page shows
// (services/customGauntlets.js); the leaderboard server reads the same record,
// with the same rules (functions/gauntlet.js customLineup).
export const DEFAULT_TITLE = 'Skeeter Gauntlet';
export const TITLE_MAX = 40;
// The games a custom gauntlet can use: everything the gauntlet page can play.
export const CUSTOM_GAME_IDS = GAUNTLET_GAMES.map(game => game.id);
// { day, title, games, creator, levels } if `data` is a usable custom
// gauntlet, else null. levels: { gameId: 1 | 2 | 3 } for games whose spice
// level was set by hand (see gamePuzzleDate in weeklyLineup.js).
export function cleanCustomGauntlet(data, day = data?.day) {
  if (!data || !isDate(day) || isTestDay(day) || !Array.isArray(data.games) || data.games.length !== GAUNTLET_SIZE) return null;
  if (!data.games.every(id => CUSTOM_GAME_IDS.includes(id)) || new Set(data.games).size !== GAUNTLET_SIZE) return null;
  const title = typeof data.title === 'string' ? data.title.trim().slice(0, TITLE_MAX) : '';
  // The featured creator, if any: their time shows under the owner's.
  const creator = typeof data.creator?.uid === 'string' && typeof data.creator?.name === 'string' && data.creator.name.trim()
    ? { uid: data.creator.uid, name: data.creator.name.trim().slice(0, 60) } : null;
  const levels = Object.fromEntries(Object.entries(data.levels && typeof data.levels === 'object' ? data.levels : {})
    .filter(([id, level]) => data.games.includes(id) && LEVELS.includes(level)));
  return { day, title: title || DEFAULT_TITLE, games: [...data.games], creator, levels };
}
const customDays = new Map();
// Replaces the known custom gauntlets (a list of Firestore records).
export function setCustomGauntlets(list) {
  customDays.clear();
  for (const entry of list ?? []) {
    const clean = cleanCustomGauntlet(entry);
    if (clean) customDays.set(clean.day, clean);
  }
}
export const customGauntlet = day => customDays.get(day) ?? null;
export const gauntletTitle = day => customDays.get(day)?.title ?? DEFAULT_TITLE;

// Today's six games, the same for everyone, each with its spice level and
// the date its puzzle comes from (normally gauntletPuzzleDate; a custom
// gauntlet's hand-set levels use other dates).
export function gauntletLineup(date) {
  if (!isDate(date)) throw new RangeError('Expected a valid YYYY-MM-DD date');
  let games = FIXED_LINEUPS[date] ?? customDays.get(date)?.games;
  // Two word games and four other puzzles, planned a week at a time so every
  // game gets a fair share (see weeklyLineup.js, shared with the server).
  if (!games) games = lineupFor(date);
  const levels = FIXED_LINEUPS[date] ? null : customDays.get(date)?.levels;
  return gamePuzzles(date, games, levels).map(game => ({ ...game, title: gameTitle(game.id) }));
}
// The puzzle date of one of a day's games.
export const gamePuzzleDateFor = (day, gameId) => gauntletLineup(day).find(game => game.id === gameId)?.puzzleDate ?? gauntletPuzzleDate(day);

// Built-in average solve times (seconds) by spice level, used for the
// give-up/loss penalty until enough community results exist.
export const DEFAULT_AVERAGE_SECONDS = {
  akari: [90, 180, 420], 'skeedle-beadle': [90, 180, 300], map: [90, 180, 360], parshle: [150, 180, 240],
  stitches: [150, 300, 540], 'skeedle-marathon': [1200, 1200, 1500], nonograms: [60, 240, 540],
  skeedlemath: [180, 180, 240], pipes: [60, 150, 330], shikaku: [90, 210, 480], quordle: [300, 300, 360],
  word500: [300, 300, 360], minesweeper: [60, 150, 300], '2048': [420, 480, 600], hashi: [120, 240, 540],
  'pepper-placer': [90, 240, 480], kakurasu: [60, 150, 360],
};
export const MIN_COMMUNITY_SOLVES = 5;

// Average daily solve time for a game at a spice level, from the community
// counters (puzzleRates documents). Falls back to the built-in estimate.
export function averageSolveSeconds(gameId, level, rateDocs = []) {
  let seconds = 0, solves = 0;
  for (const doc of rateDocs) {
    if (doc?.mode !== 'daily' || !isDate(doc.date) || !(doc.timedWins > 0) || !(doc.winSeconds > 0)) continue;
    if (dailyDifficulty(gameId, doc.date) !== level) continue;
    seconds += doc.winSeconds; solves += doc.timedWins;
  }
  if (solves >= MIN_COMMUNITY_SOLVES) return { seconds: toMinute(seconds / solves), source: 'community' };
  const fallback = DEFAULT_AVERAGE_SECONDS[gameId] ?? [180, 240, 360];
  return { seconds: toMinute(fallback[Math.min(Math.max(level, 1), 3) - 1]), source: 'estimate' };
}
// Penalties are whole minutes (at least one).
const toMinute = seconds => Math.max(60, Math.round(seconds / 60) * 60);

// The give-up penalty shrinks by a second for every second spent on the game
// and is gone once the player has spent the average solve time, so finishing
// is always worth it: giving up never costs more than the average in total.
export const remainingPenalty = (penalty, spentSeconds) => Math.max(0, Math.round(penalty) - Math.max(0, Math.floor(spentSeconds)));

// ----- A run (one per day) -----

export function newRun(date, now) {
  return { version: 1, date, lineup: gauntletLineup(date).map(game => game.id), startedAt: now,
    index: 0, gameStartedAt: now, results: [], finishedAt: null, waiting: false };
}

// A finished game. Won: the time it took. Lost or gave up: the time spent plus
// whatever is left of the penalty (see remainingPenalty).
// Word games: each guess you didn't need takes 5 seconds off your time.
// Solving in 1 of 6 guesses saves 30s, in 2 saves 25s ... in 6 saves 5s.
export const WORD_GUESS_LIMITS = { skeedlemath: 6, quordle: 9, parshle: 6, word500: 8 };
export const GUESS_BONUS_SECONDS = 5;
export function guessBonus(gameId, guesses) {
  const limit = WORD_GUESS_LIMITS[gameId];
  if (!limit || !Number.isInteger(guesses) || guesses < 1 || guesses > limit) return 0;
  return GUESS_BONUS_SECONDS * (limit - guesses + 1);
}
// The bonus shown beside guess row `row` (0 = first guess).
export const rowBonus = (gameId, row) => guessBonus(gameId, row + 1);

// Skeedle Beadle: every hint adds 5 seconds to your time.
export const HINT_SECONDS = 5;
export const HINT_GAMES = ['skeedle-beadle'];
export function hintPenalty(gameId, hints) {
  if (!HINT_GAMES.includes(gameId) || !Number.isInteger(hints) || hints < 1) return 0;
  return HINT_SECONDS * Math.min(hints, 1000);
}

export function recordResult(run, { gameId, status, now, penalty = 0, guesses, hints, answer }) {
  if (!run || run.finishedAt || run.waiting || run.lineup[run.index] !== gameId) return run;
  run = resumeRun(run, now);
  const spent = Math.max(0, Math.round((now - run.gameStartedAt) / 1000));
  const added = status === 'won' ? 0 : remainingPenalty(penalty, spent);
  const bonus = status === 'won' ? guessBonus(gameId, guesses) : 0;
  const hinted = hintPenalty(gameId, hints);
  const result = { game: gameId, status, seconds: spent, penalty: added, hintPenalty: hinted, bonus, total: Math.max(0, spent + added + hinted - bonus) };
  // A word game that wasn't solved keeps its answer, to show the player.
  if (status !== 'won' && typeof answer === 'string' && answer) result.answer = answer;
  const results = [...run.results, result];
  const finished = results.length === run.lineup.length;
  return { ...run, results, index: run.index + 1, waiting: !finished, finishedAt: finished ? now : null };
}

// The next game's clock starts when the player continues.
export function startNextGame(run, now) {
  if (!run?.waiting) return run;
  return { ...run, waiting: false, gameStartedAt: now, pausedAt: null };
}

// Opening How to play pauses the clock (the board is hidden meanwhile). Each
// run gets up to PAUSE_ALLOWANCE seconds of paused time in total; the server
// applies the same limit to leaderboard runs.
export const PAUSE_ALLOWANCE = 300;
export function pauseRun(run, now) {
  if (!run || run.finishedAt || run.waiting || run.pausedAt) return run;
  return { ...run, pausedAt: now };
}
export function resumeRun(run, now) {
  if (!run?.pausedAt) return run;
  const used = run.pausedSeconds ?? 0;
  const credit = Math.min(Math.max(0, Math.floor((now - run.pausedAt) / 1000)), Math.max(0, PAUSE_ALLOWANCE - used));
  return { ...run, gameStartedAt: run.gameStartedAt + credit * 1000, pausedAt: null, pausedSeconds: used + credit };
}

export const runTotal = run => (run?.results ?? []).reduce((sum, result) => sum + result.total, 0);
// While paused the clock stands still (until the pause allowance runs out).
export function currentGameSeconds(run, now) {
  if (!run || run.finishedAt || run.waiting) return 0;
  return Math.max(0, Math.floor((now - resumeRun(run, now).gameStartedAt) / 1000));
}

export function formatClock(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600), m = Math.floor(total % 3600 / 60), s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function shareText(run, origin = 'https://skeetergames.org', par = null) {
  const day = new Date(`${run.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const marks = run.results.map(result => result.status === 'won' ? '🟩' : '🟥').join('');
  const solved = run.results.filter(result => result.status === 'won').length;
  const versus = par ? `\n${parVerdict(runTotal(run), par.total)}` : '';
  return `${gauntletTitle(run.date)} · ${day}\n⏱ ${formatClock(runTotal(run))} · ${solved}/${run.lineup.length} solved${versus}\n${marks}\n${origin}/gauntlet`;
}

// ----- The owner's time to beat -----

// The owner's published result, as stored in Firestore (gauntletPar/{day}).
export function parRecord(run) {
  return { day: run.date, total: runTotal(run), solved: run.results.filter(result => result.status === 'won').length,
    games: [...run.lineup], levels: gauntletLineup(run.date).map(game => game.level),
    results: run.results.map(({ game, status, total }) => ({ game, status, total })) };
}
// A published par is trusted only if it matches today's lineup.
export function validPar(par, day) {
  if (!par || par.day !== day || !Number.isInteger(par.total) || par.total < 0) return null;
  const lineup = gauntletLineup(day).map(game => game.id);
  if (!Array.isArray(par.games) || par.games.join() !== lineup.join()) return null;
  if (!Array.isArray(par.results) || par.results.length !== lineup.length) return null;
  // Played at the same spice levels (an older record without levels was
  // played at the day's usual ones).
  const levels = gauntletLineup(day).map(game => game.level).join();
  const played = Array.isArray(par.levels) ? par.levels.join() : lineup.map(id => dailyDifficulty(id, gauntletPuzzleDate(day))).join();
  if (played !== levels) return null;
  return par;
}
export function parVerdict(total, parTotal, name = PAR_NAME) {
  const gap = formatClock(Math.abs(total - parTotal));
  return total < parTotal ? `Beat ${name} by ${gap} 🏆` : total > parTotal ? `${name} wins by ${gap}` : `Tied with ${name}!`;
}
// A custom gauntlet's featured creator's time (gauntletGuest/{day}, written
// by the leaderboard server when they finish), trusted only if it's the
// day's current featured creator and matches the day's lineup.
export function validGuest(guest, day) {
  if (!validPar(guest, day) || typeof guest.name !== 'string' || !guest.name.trim()) return null;
  return customDays.get(day)?.creator?.uid === guest.uid ? guest : null;
}
// After some games: how far ahead (negative) or behind (positive) the owner's pace.
export function paceVersusPar(run, par) {
  if (!run || !par) return null;
  const count = run.results.length;
  if (!count) return null;
  const parSoFar = par.results.slice(0, count).reduce((sum, result) => sum + result.total, 0);
  return runTotal(run) - parSoFar;
}

// History: { [date]: { total, solved } } for finished runs.
export function addToHistory(history, run) {
  if (!run?.finishedAt) return history;
  return { ...history, [run.date]: { total: runTotal(run), solved: run.results.filter(r => r.status === 'won').length } };
}
// Adds gauntlets saved on the player's account (players/{uid}.gauntletHistory,
// written by the leaderboard server) to this device's history, so streaks
// follow a signed-in player between devices. This device's own entry wins.
export function mergeHistory(local, remote) {
  if (!remote || typeof remote !== 'object') return local ?? {};
  const merged = {};
  for (const [date, entry] of Object.entries(remote)) {
    if (isDate(date) && !isTestDay(date) && entry && Number.isFinite(entry.total)) merged[date] = { total: entry.total, solved: Number(entry.solved) || 0 };
  }
  return { ...merged, ...(local ?? {}) };
}
export function historySummary(history, today) {
  const dates = Object.keys(history ?? {}).filter(isDate).sort();
  const totals = dates.map(date => history[date].total).filter(Number.isFinite);
  let streak = 0;
  for (let date = history?.[today] ? today : addDays(today, -1); history?.[date]; date = addDays(date, -1)) streak++;
  let best = 0, run = 0, previous = null;
  for (const date of dates) { run = previous && addDays(previous, 1) === date ? run + 1 : 1; best = Math.max(best, run); previous = date; }
  return { played: dates.length, bestTime: totals.length ? Math.min(...totals) : null, streak, maxStreak: best };
}

// Validates a run read back from storage.
// Leaderboard runs are timed by the server. Its copy of the run becomes the
// page's run, with its timestamps moved onto this device's clock (skew =
// server clock minus device clock).
export function fromServerRun(serverRun, skew = 0) {
  if (!serverRun) return null;
  const local = ms => ms === null || ms === undefined ? null : ms - skew;
  return restoreRun({ version: 1, date: serverRun.day, lineup: serverRun.lineup, startedAt: local(serverRun.startedAt),
    index: serverRun.index, gameStartedAt: local(serverRun.gameStartedAt), results: serverRun.results,
    finishedAt: local(serverRun.finishedAt), waiting: serverRun.waiting, ranked: true,
    pausedAt: local(serverRun.pausedAt), pausedSeconds: serverRun.pausedSeconds ?? 0 }, serverRun.day);
}

// The leaderboard server doesn't keep word-game answers, so when its copy of
// a run replaces this page's, carry over the answers the page already had.
export function keepAnswers(run, previous) {
  if (!run || !Array.isArray(previous?.results) || previous.date !== run.date) return run;
  let changed = false;
  const results = run.results.map((result, i) => {
    const known = previous.results[i];
    if (result.answer || result.status === 'won' || !known?.answer || known.game !== result.game) return result;
    changed = true;
    return { ...result, answer: known.answer };
  });
  return changed ? { ...run, results } : run;
}

export function restoreRun(saved, date) {
  if (!saved || saved.version !== 1 || saved.date !== date || !Array.isArray(saved.lineup) || !Array.isArray(saved.results)) return null;
  const expected = gauntletLineup(date).map(game => game.id);
  if (saved.lineup.join() !== expected.join() || saved.results.length > expected.length || saved.index !== saved.results.length) return null;
  if (!Number.isFinite(saved.startedAt) || !Number.isFinite(saved.gameStartedAt)) return null;
  return saved;
}
