import { scheduledDifficulty } from '../../utils/dailySchedule.js';
import { findUci, gameEnd, makeMove, parseFen, uci } from './engine.js';
import BANK_INFO from './bankInfo.js';

// Chess puzzles: "find the best move". The opponent's move is played first,
// then the player finds each of their moves while the opponent replies.
//
// The puzzles aren't bundled with the site. scripts/build-chess-puzzles.mjs
// writes them to public/chess: each month's dailies (daily/YYYY-MM.json, a
// puzzle per date) and practice batches (practice/LEVEL-N.json). The page
// loads what it needs with loadChessPuzzles before showing a puzzle.

// Rating range for each spice level (Lichess puzzle ratings).
export const LEVEL_RATINGS = [[0, 1400], [1400, 1900], [1900, 4000]];
export const levelOf = rating => LEVEL_RATINGS.findIndex(([low, high]) => rating >= low && rating < high) + 1 || 3;
export const dailyLevel = date => scheduledDifficulty('chess', date);

export const toPuzzle = ([id, fen, moves, rating, themes]) => ({
  id, fen, moves: moves.trim().split(/\s+/), rating, themes: themes ? themes.split(/\s+/) : [],
});

export function seededRandom(seed) {
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----- Loading -----
const fetchJson = path => fetch(`/chess/${path}?v=${BANK_INFO.version}`).then(response => {
  if (!response.ok) throw new Error(`Couldn't load chess puzzles (${response.status})`);
  return response.json();
});
const loading = new Map(); // path -> promise
const months = new Map(); // 'YYYY-MM' -> { date: row }
const practice = new Map(); // level -> puzzles
function load(path, keep) {
  if (!loading.has(path)) {
    const promise = fetchJson(path).then(keep);
    promise.catch(() => loading.delete(path)); // so a retry fetches again
    loading.set(path, promise);
  }
  return loading.get(path);
}
// Loads `date`'s daily and a random batch of practice puzzles per level.
// Resolves when dailyPuzzle(date) and practicePuzzle(level) are ready.
export function loadChessPuzzles(date, random = Math.random) {
  const month = date.slice(0, 7);
  return Promise.all([
    load(`daily/${month}.json`, rows => months.set(month, rows)),
    ...[1, 2, 3].map(level => {
      const batch = Math.floor(random() * BANK_INFO.practiceBatches[level]);
      return practice.has(level) ? null : load(`practice/${level}-${batch}.json`, rows => practice.set(level, rows.map(toPuzzle)));
    }),
  ]);
}
// For tests and the build script: provide data without fetching.
export function provideChessPuzzles({ daily = {}, practice: batches = {} }) {
  for (const [date, row] of Object.entries(daily)) {
    const month = date.slice(0, 7);
    months.set(month, { ...(months.get(month) ?? {}), [date]: row });
  }
  for (const [level, rows] of Object.entries(batches)) practice.set(Number(level), rows.map(toPuzzle));
}

// The daily puzzle for `date` (after loadChessPuzzles(date)).
export function dailyPuzzle(date) {
  const row = months.get(date.slice(0, 7))?.[date];
  if (!row) throw new Error(`No chess puzzle for ${date}`);
  return toPuzzle(row);
}
export function practicePuzzle(level, avoidId = null, random = Math.random) {
  const all = practice.get(level) ?? [...practice.values()].flat();
  const pool = all.filter(puzzle => puzzle.id !== avoidId);
  const list = pool.length ? pool : all;
  return list[Math.floor(random() * list.length)];
}

// Positions along the solution: positions[0] is before the opponent's first
// move, positions[i] after moves[0..i-1]. The player moves at odd i.
export function puzzlePositions(puzzle) {
  const positions = [parseFen(puzzle.fen)];
  for (const text of puzzle.moves) {
    const move = findUci(positions.at(-1), text);
    if (!move) throw new Error(`Puzzle ${puzzle.id}: illegal move ${text}`);
    positions.push(makeMove(positions.at(-1), move));
  }
  return positions;
}
export const playerColor = puzzle => parseFen(puzzle.fen).turn === 'w' ? 'b' : 'w';

// Is the player's move right? The solution move is, and on the last move any
// move that checkmates counts too (puzzles sometimes have more than one mate).
export function judgeMove(puzzle, step, pos, move) {
  const expected = puzzle.moves[step];
  if (uci(move) === expected) return true;
  return step === puzzle.moves.length - 1 && gameEnd(makeMove(pos, move)) === 'checkmate';
}

// Problems with a puzzle, or [] if it plays through (used by tests and the
// import script).
export function puzzleProblems(puzzle) {
  const problems = [];
  try {
    const positions = puzzlePositions(puzzle);
    if (puzzle.moves.length < 2 || puzzle.moves.length % 2) problems.push('needs the opponent move plus whole player turns');
    if (puzzle.themes.some(theme => /^mateIn\d$|^mate$/.test(theme)) && gameEnd(positions.at(-1)) !== 'checkmate') problems.push('mate theme but no mate');
  } catch (error) {
    problems.push(error.message);
  }
  return problems;
}
