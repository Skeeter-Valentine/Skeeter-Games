import { scheduledDifficulty } from '../../utils/dailySchedule.js';
import { findUci, gameEnd, makeMove, parseFen, uci } from './engine.js';
import BANK from './puzzleBank.js';

// Chess puzzles: "find the best move". The opponent's move is played first,
// then the player finds each of their moves while the opponent replies.

// Rating range for each spice level (Lichess puzzle ratings).
export const LEVEL_RATINGS = [[0, 1400], [1400, 1900], [1900, 4000]];
export const levelOf = rating => LEVEL_RATINGS.findIndex(([low, high]) => rating >= low && rating < high) + 1 || 3;
export const dailyLevel = date => scheduledDifficulty('chess', date);

export const toPuzzle = ([id, fen, moves, rating, themes]) => ({
  id, fen, moves: moves.trim().split(/\s+/), rating, themes: themes ? themes.split(/\s+/) : [],
});
export const ALL_PUZZLES = BANK.map(toPuzzle);
export const puzzlesFor = level => {
  const pool = ALL_PUZZLES.filter(puzzle => levelOf(puzzle.rating) === level);
  return pool.length ? pool : ALL_PUZZLES;
};

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
export function dailyPuzzle(date) {
  const level = dailyLevel(date);
  const pool = shuffled(level);
  return pool[levelDayIndex(date, level) % pool.length];
}
export function practicePuzzle(level, avoidId = null, random = Math.random) {
  const pool = puzzlesFor(level).filter(puzzle => puzzle.id !== avoidId);
  const list = pool.length ? pool : puzzlesFor(level);
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
