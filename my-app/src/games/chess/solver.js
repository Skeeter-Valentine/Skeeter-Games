import { gameEnd, legalMoves, makeMove } from './engine.js';

// Forced-mate search, for checking puzzles: does `move` mate in at most `n`
// moves of the side to move, whatever the defence?
export function forcesMate(pos, move, n) {
  const next = makeMove(pos, move);
  const end = gameEnd(next);
  if (end === 'checkmate') return true;
  if (end || n <= 1) return false;
  return legalMoves(next).every(reply => mateMoves(makeMove(next, reply), n - 1).length > 0);
}

// Every move that forces mate in at most `n`.
export function mateMoves(pos, n) {
  return legalMoves(pos).filter(move => forcesMate(pos, move, n));
}

// The fewest moves to a forced mate (up to `max`), or null.
export function mateDistance(pos, max = 3) {
  for (let n = 1; n <= max; n++) if (mateMoves(pos, n).length) return n;
  return null;
}
