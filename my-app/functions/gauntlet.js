// Skeeter Gauntlet server rules: run timing, the daily leaderboard and
// nicknames. Pure functions (no Firebase imports) so they are unit tested and
// shared by the Cloud Functions in index.js.
//
// Lineups come from src/gauntlet/weeklyLineup.js, the same code the site
// runs (lineup.test.mjs checks the two agree), so a player can never submit a
// different lineup.

import { WORD_GAMES, lineupFor } from './shared/gauntlet/weeklyLineup.js';

export const GAUNTLET_GAMES = ['akari', 'skeedle-beadle', 'map', 'parshle', 'stitches', 'nonograms', 'skeedlemath',
  'pipes', 'shikaku', 'quordle', 'word500', 'minesweeper', 'hashi', 'pepper-placer'];
export const GAUNTLET_SIZE = 6;
const FIXED_LINEUPS = {
  '2099-01-01': ['akari', 'skeedle-beadle', 'map', 'parshle', 'stitches', 'nonograms'],
  '2099-01-02': ['skeedlemath', 'pipes', 'shikaku', 'quordle', 'word500', 'minesweeper'],
  '2099-01-03': ['hashi', 'map', 'word500', 'stitches', 'akari', 'pepper-placer'],
};
export const isDay = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)
  && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
export const isTestDay = day => isDay(day) && day.startsWith('2099-');

// Lineups come from the same module the site uses (copied into
// functions/shared by scripts/sync-functions-shared.mjs before deploys).
export { WORD_GAMES };
export function lineupIds(day) {
  if (FIXED_LINEUPS[day]) return [...FIXED_LINEUPS[day]];
  return lineupFor(day);
}

// The gauntlet day for an instant: 4am Denver time starts a new day.
const denverParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric' });
export function gauntletDay(now) {
  const p = Object.fromEntries(denverParts.formatToParts(new Date(now)).map(part => [part.type, Number(part.value)]));
  const date = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  return p.hour < 4 ? new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) : date;
}
// Real runs must be for today's gauntlet (or yesterday's, to finish a run that
// crossed 4am); test days are always allowed.
export function dayAllowed(day, now) {
  if (isTestDay(day)) return true;
  if (!isDay(day)) return false;
  const today = gauntletDay(now);
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  return day === today || day === yesterday;
}

// Penalties are whole minutes between 1 and 60 (the client sends the average
// solve time it shows; the server only accepts sensible values).
export const PAUSE_ALLOWANCE = 300;
export function resumeRun(run, now) {
  if (!run?.pausedAt) return run;
  const used = run.pausedSeconds ?? 0;
  const credit = Math.min(Math.max(0, Math.floor((now - run.pausedAt) / 1000)), Math.max(0, PAUSE_ALLOWANCE - used));
  return { ...run, gameStartedAt: run.gameStartedAt + credit * 1000, pausedAt: null, pausedSeconds: used + credit };
}
// Word games: each guess you didn't need takes 5 seconds off your time.
// Solving in 1 of 6 guesses saves 30s, in 2 saves 25s ... in 6 saves 5s.
export const WORD_GUESS_LIMITS = { skeedlemath: 6, quordle: 9, parshle: 6, word500: 8 };
export const GUESS_BONUS_SECONDS = 5;
export function guessBonus(gameId, guesses) {
  const limit = WORD_GUESS_LIMITS[gameId];
  if (!limit || !Number.isInteger(guesses) || guesses < 1 || guesses > limit) return 0;
  return GUESS_BONUS_SECONDS * (limit - guesses + 1);
}

// Skeedle Beadle: every hint adds 5 seconds to your time.
export const HINT_SECONDS = 5;
export const HINT_GAMES = ['skeedle-beadle'];
export function hintPenalty(gameId, hints) {
  if (!HINT_GAMES.includes(gameId) || !Number.isInteger(hints) || hints < 1) return 0;
  return HINT_SECONDS * Math.min(hints, 1000);
}

export const clampPenalty = seconds => Math.min(3600, Math.max(60, Math.round((Number(seconds) || 0) / 60) * 60));
// Faster than this is not a real solve.
export const MIN_WIN_SECONDS = 5;

export class GauntletError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// Applies one event to a player's run (null = no run yet) using the server
// clock. Returns the new run and, when the run finishes, its leaderboard entry.
export function applyEvent(run, event, now) {
  const { action, day } = event ?? {};
  if (!dayAllowed(day, now)) throw new GauntletError('invalid-argument', 'That gauntlet is not open.');
  if (action === 'reset') {
    if (!isTestDay(day)) throw new GauntletError('failed-precondition', 'Only test gauntlets can be restarted.');
    return { run: null, reset: true };
  }
  if (action === 'start') {
    // A run started under an older lineup rule (before a rules update) can't
    // be played with today's games, so it is replaced. Finished runs stand.
    const stale = run && !run.finishedAt && run.lineup?.join() !== lineupIds(day).join();
    if (run && !stale) return { run, alreadyStarted: true };
    if (!isTestDay(day) && day !== gauntletDay(now)) throw new GauntletError('failed-precondition', 'That gauntlet has closed.');
    return { run: { day, lineup: lineupIds(day), index: 0, gameStartedAt: now, waiting: false, results: [], startedAt: now, finishedAt: null } };
  }
  if (!run) throw new GauntletError('failed-precondition', 'Start the gauntlet first.');
  if (run.finishedAt) throw new GauntletError('failed-precondition', 'This gauntlet is already finished.');
  if (action === 'next') {
    if (!run.waiting) return { run };
    return { run: { ...run, waiting: false, gameStartedAt: now, pausedAt: null } };
  }
  // How to play pauses the clock, up to PAUSE_ALLOWANCE seconds per run.
  if (action === 'pause') {
    if (run.waiting || run.pausedAt) return { run };
    return { run: { ...run, pausedAt: now } };
  }
  if (action === 'resume') return { run: resumeRun(run, now) };
  if (action === 'finish') {
    const { game, status } = event;
    if (run.waiting || run.lineup[run.index] !== game) throw new GauntletError('failed-precondition', 'That is not the current game.');
    run = resumeRun(run, now);
    if (!['won', 'lost', 'gave-up'].includes(status)) throw new GauntletError('invalid-argument', 'Unknown result.');
    const spent = Math.max(0, Math.round((now - run.gameStartedAt) / 1000));
    if (status === 'won' && spent < MIN_WIN_SECONDS) throw new GauntletError('failed-precondition', 'That solve was too fast to count.');
    const penalty = status === 'won' ? 0 : Math.max(0, clampPenalty(event.penalty) - spent);
    const bonus = status === 'won' ? guessBonus(game, event.guesses) : 0;
    const hinted = hintPenalty(game, event.hints);
    const results = [...run.results, { game, status, seconds: spent, penalty, hintPenalty: hinted, bonus, total: Math.max(0, spent + penalty + hinted - bonus) }];
    const finished = results.length === run.lineup.length;
    const next = { ...run, results, index: run.index + 1, waiting: !finished, finishedAt: finished ? now : null };
    return { run: next, entry: finished ? boardEntry(next) : null };
  }
  throw new GauntletError('invalid-argument', 'Unknown action.');
}

// Leaderboard order: more games solved first, then the faster total time.
// One number sorts both ways, so a single-field index is enough.
export const boardScore = (solved, total) => (GAUNTLET_SIZE - solved) * 1e7 + total;
export function boardEntry(run) {
  const solved = run.results.filter(result => result.status === 'won').length;
  const total = run.results.reduce((sum, result) => sum + result.total, 0);
  return { solved, total, score: boardScore(solved, total), finishedAt: run.finishedAt };
}

// ----- Advance runs (site owner) -----
// The owner plays upcoming gauntlets early (/gauntlet?day=…) to film them. The
// finished run is posted to that day's leaderboard as if it had been played
// the moment the day opened. Its timing comes from the owner's browser, so
// only the owner may record one; the numbers are still checked for sense.
export function gauntletOpensAt(day) {
  // 4am Denver is 10:00 UTC in summer time and 11:00 UTC in winter.
  const summer = Date.parse(`${day}T10:00:00Z`);
  return gauntletDay(summer) === day ? summer : summer + 3600000;
}
const addDay = (day, days) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export const ADVANCE_DAYS = 60;
const wholeSeconds = (value, max) => Number.isFinite(value) && value >= 0 ? Math.min(max, Math.round(value)) : null;
export function recordAdvanceRun(day, submitted, now) {
  const today = gauntletDay(now);
  if (!isDay(day) || isTestDay(day) || day < addDay(today, -1) || day > addDay(today, ADVANCE_DAYS)) {
    throw new GauntletError('invalid-argument', 'That gauntlet can\'t be recorded.');
  }
  const lineup = lineupIds(day);
  const raw = submitted?.results;
  if (!Array.isArray(raw) || raw.length !== lineup.length) throw new GauntletError('invalid-argument', 'Only a finished gauntlet can be recorded.');
  const results = raw.map((result, i) => {
    const game = lineup[i];
    if (result?.game !== game || !['won', 'lost', 'gave-up'].includes(result.status)) throw new GauntletError('invalid-argument', 'That run doesn\'t match the gauntlet.');
    const seconds = wholeSeconds(result.seconds, 3 * 3600);
    if (seconds === null) throw new GauntletError('invalid-argument', 'That run has an invalid time.');
    const won = result.status === 'won';
    const penalty = won ? 0 : wholeSeconds(result.penalty, 3600) ?? 0;
    const bonusCap = won && WORD_GUESS_LIMITS[game] ? GUESS_BONUS_SECONDS * WORD_GUESS_LIMITS[game] : 0;
    const bonus = Math.min(bonusCap, wholeSeconds(result.bonus, bonusCap) ?? 0);
    const hinted = HINT_GAMES.includes(game) ? wholeSeconds(result.hintPenalty, 3600) ?? 0 : 0;
    return { game, status: result.status, seconds, penalty, hintPenalty: hinted, bonus, total: Math.max(0, seconds + penalty + hinted - bonus) };
  });
  // Played start to finish at opening time, taking as long as it really took.
  const startedAt = gauntletOpensAt(day);
  const elapsed = Number(submitted.finishedAt) - Number(submitted.startedAt);
  const length = Number.isFinite(elapsed) && elapsed > 0 ? Math.min(elapsed, 12 * 3600000)
    : results.reduce((sum, result) => sum + result.seconds, 0) * 1000;
  const finishedAt = startedAt + Math.round(length);
  const run = { day, lineup, index: lineup.length, gameStartedAt: finishedAt, waiting: false, results, startedAt, finishedAt, recordedInAdvance: true };
  return { run, entry: boardEntry(run) };
}

// ----- Nicknames -----
// 3-16 letters, numbers, spaces, underscores or hyphens; unique ignoring case.
const BLOCKED = ['fuck', 'shit', 'cunt', 'bitch', 'nigg', 'fag', 'retard', 'whore', 'slut', 'rape', 'nazi', 'hitler',
  'penis', 'vagina', 'cock', 'dick', 'pussy', 'porn', 'sex', 'kike', 'spic', 'chink', 'tranny', 'admin', 'moderator', 'skeeter'];
// The site owner may use reserved names such as "Skeeter".
const RESERVED = ['admin', 'moderator', 'skeeter'];
export function cleanNickname(raw, { owner = false } = {}) {
  const nickname = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (nickname.length < 3 || nickname.length > 16) throw new GauntletError('invalid-argument', 'Nicknames are 3–16 characters.');
  if (!/^[A-Za-z0-9 _-]+$/.test(nickname)) throw new GauntletError('invalid-argument', 'Use letters, numbers, spaces, _ or - only.');
  const squashed = nickname.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't');
  if (BLOCKED.some(word => squashed.includes(word) && !(owner && RESERVED.includes(word)))) throw new GauntletError('invalid-argument', 'Please choose a different nickname.');
  return { nickname, key: nickname.toLowerCase().replace(/[^a-z0-9]/g, '') };
}
