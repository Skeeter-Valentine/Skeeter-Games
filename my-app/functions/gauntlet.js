// Skeeter Gauntlet server rules: run timing, the daily leaderboard and
// nicknames. Pure functions (no Firebase imports) so they are unit tested and
// shared by the Cloud Functions in index.js.
//
// The lineup code mirrors src/gauntlet/gauntlet.js; gauntlet.test.mjs checks
// the two always agree, so a player can never submit a different lineup.

export const GAUNTLET_GAMES = ['akari', 'skeedle-beadle', 'map', 'parshle', 'stitches', 'nonograms', 'skeedlemath',
  'pipes', 'shikaku', 'quordle', 'word500', 'minesweeper', 'hashi'];
export const GAUNTLET_SIZE = 6;
const FIXED_LINEUPS = {
  '2099-01-01': ['akari', 'skeedle-beadle', 'map', 'parshle', 'stitches', 'nonograms'],
  '2099-01-02': ['skeedlemath', 'pipes', 'shikaku', 'quordle', 'word500', 'minesweeper'],
  '2099-01-03': ['hashi', 'map', 'word500', 'stitches', 'akari', 'pipes'],
};
export const isDay = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)
  && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
export const isTestDay = day => isDay(day) && day.startsWith('2099-');

function seeded(seedText) {
  let state = 2166136261;
  for (const char of seedText) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const WORD_GAMES = ['skeedlemath', 'quordle', 'parshle', 'word500'];
export function lineupIds(day) {
  if (FIXED_LINEUPS[day]) return [...FIXED_LINEUPS[day]];
  const rng = seeded(`skeeter-gauntlet-v2:${day}`);
  const shuffle = list => {
    const items = [...list];
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };
  // Exactly two word games, four of the other puzzles, in a shuffled order.
  const words = GAUNTLET_GAMES.filter(id => WORD_GAMES.includes(id));
  const others = GAUNTLET_GAMES.filter(id => !WORD_GAMES.includes(id));
  return shuffle([...shuffle(words).slice(0, 2), ...shuffle(others).slice(0, GAUNTLET_SIZE - 2)]);
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
    if (run) return { run, alreadyStarted: true };
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
    const results = [...run.results, { game, status, seconds: spent, penalty, total: spent + penalty }];
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
