import { CAPACITY } from './puzzle.js';

// Daily and archive Skeedle Beadle progress, tied to the exact starting sticks.
export const beadleSaveKey = (date, archive) => `${archive ? 'archive:v1:' : ''}skeedle-beadle-daily-v1:${date}`;
export const HISTORY_LIMIT = 300;

const whole = value => Number.isInteger(value) && value >= 0 ? value : 0;
const colorCounts = sticks => sticks.flat().reduce((counts, color) => counts.set(color, (counts.get(color) || 0) + 1), new Map());

// A saved arrangement must use the same sticks and exactly the same beads.
export function validArrangement(start, sticks) {
  if (!Array.isArray(sticks) || sticks.length !== start.length) return false;
  if (!sticks.every(stick => Array.isArray(stick) && stick.length <= CAPACITY && stick.every(Number.isInteger))) return false;
  const expected = colorCounts(start), actual = colorCounts(sticks);
  return expected.size === actual.size && [...expected].every(([color, count]) => actual.get(color) === count);
}

export function saveBeadle(puzzle, { sticks, history, moves, hints, seconds, started }) {
  return { fingerprint: JSON.stringify(puzzle.sticks), sticks, history: history.slice(-HISTORY_LIMIT), moves, hints, seconds, started };
}

export function restoreBeadle(puzzle, saved) {
  const fresh = { sticks: puzzle.sticks.map(stick => stick.slice()), history: [], moves: 0, hints: 0, seconds: 0, started: false };
  if (!saved || saved.fingerprint !== JSON.stringify(puzzle.sticks) || !validArrangement(puzzle.sticks, saved.sticks)) return fresh;
  const history = (Array.isArray(saved.history) ? saved.history : [])
    .filter(step => step && validArrangement(puzzle.sticks, step.sticks))
    .map(step => ({ sticks: step.sticks, moves: whole(step.moves) })).slice(-HISTORY_LIMIT);
  return { sticks: saved.sticks, history, moves: whole(saved.moves), hints: whole(saved.hints), seconds: whole(saved.seconds),
    started: !!saved.started || whole(saved.moves) > 0 };
}
