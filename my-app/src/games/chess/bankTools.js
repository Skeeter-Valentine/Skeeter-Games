// Tools for the chess puzzle bank, used by scripts/build-chess-puzzles.mjs
// and the tests (never by the site, so the bank isn't bundled with it).
import { attacked, colorOf, gameEnd, legalMoves, makeMove } from './engine.js';
import BANK from './puzzleBank.js';
import { dailyLevel, levelOf, playerColor, puzzlePositions, seededRandom, toPuzzle } from './puzzles.js';

export const ALL_PUZZLES = BANK.map(toPuzzle);
export const puzzlesFor = level => {
  const pool = ALL_PUZZLES.filter(puzzle => levelOf(puzzle.rating) === level);
  return pool.length ? pool : ALL_PUZZLES;
};

// The daily: each level's puzzles in a fixed shuffled order, one per day of
// that level, so nothing repeats until the level's list runs out.
const EPOCH = Date.UTC(2026, 0, 1);
const dayNumber = date => Math.round((Date.parse(`${date}T00:00:00Z`) - EPOCH) / 86400000);
const orderCache = new Map();
function shuffled(level) {
  if (!orderCache.has(level)) {
    const pool = [...puzzlesFor(level)].sort((a, b) => a.id.localeCompare(b.id));
    const rng = seededRandom(`chess-v1:${level}`);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    orderCache.set(level, pool);
  }
  return orderCache.get(level);
}
// How many earlier days (since EPOCH) had this date's level.
function levelDayIndex(date, level) {
  let count = 0;
  for (let day = 0; day < dayNumber(date); day++) {
    if (dailyLevel(new Date(EPOCH + day * 86400000).toISOString().slice(0, 10)) === level) count++;
  }
  return count;
}
// How dailies were picked before the bank moved to public/chess (the build
// script keeps those dates' puzzles). From CLEAR_FROM, dailies are only puzzles with a clear payoff (see
// clearFinish), in the same order, skipping any already shown. Earlier days
// keep the puzzle they had.
export const CLEAR_FROM = '2026-11-22';
const clearCache = new Map();
function clearOrder(level) {
  if (!clearCache.has(level)) {
    const shown = new Set(shuffled(level).slice(0, levelDayIndex(CLEAR_FROM, level)).map(puzzle => puzzle.id));
    const clear = shuffled(level).filter(puzzle => clearFinish(puzzle) && !shown.has(puzzle.id));
    clearCache.set(level, clear.length ? clear : shuffled(level));
  }
  return clearCache.get(level);
}
export function legacyDailyPuzzle(date) {
  const level = dailyLevel(date);
  const pool = shuffled(level);
  const index = levelDayIndex(date, level);
  if (date < CLEAR_FROM) return pool[index % pool.length];
  const clear = clearOrder(level);
  return clear[(index - levelDayIndex(CLEAR_FROM, level)) % clear.length];
}
// ----- What the solution wins -----
// A puzzle has a clear finish when it ends in checkmate, or leaves the player
// at least CLEAR_GAIN points of material up (pawn 1, knight and bishop 3, rook
// 5, queen 9) on the board, compared with before the opponent's first move,
// after the opponent's best immediate capture. Puzzles won by a quieter edge
// (a better endgame, a pawn that will promote) are left out of the daily.
export const CLEAR_GAIN = 3;
const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const valueOf = piece => VALUES[piece.toLowerCase()];
const balance = (board, color) => board.reduce((sum, piece) => (piece ? sum + (colorOf(piece) === color ? 1 : -1) * valueOf(piece) : sum), 0);
// The most material the side to move can win straight away (a capture, less
// the capturing piece when it can be taken back).
function bestCapture(pos, defender) {
  let best = 0;
  for (const move of legalMoves(pos)) {
    if (!move.captured && !move.ep) continue;
    const after = makeMove(pos, move);
    const taken = move.captured ? valueOf(move.captured) : 1;
    best = Math.max(best, taken - (attacked(after.board, move.to, defender) ? valueOf(move.piece) : 0));
  }
  return best;
}
// { mate, gain }: gain is the player's material won (99 for a mate).
export function puzzleFinish(puzzle) {
  const positions = puzzlePositions(puzzle), player = playerColor(puzzle), end = positions.at(-1);
  if (gameEnd(end) === 'checkmate') return { mate: true, gain: 99 };
  return { mate: false, gain: balance(end.board, player) - balance(positions[0].board, player) - bestCapture(end, player) };
}
const finishCache = new Map();
export function clearFinish(puzzle) {
  if (!finishCache.has(puzzle.id)) finishCache.set(puzzle.id, puzzleFinish(puzzle).gain >= CLEAR_GAIN);
  return finishCache.get(puzzle.id);
}
