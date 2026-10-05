import assert from 'node:assert/strict';
import test from 'node:test';
import { generatePuzzle, slide, solve } from './puzzle.js';
import { HISTORY_LIMIT, restoreBeadle, saveBeadle, beadleSaveKey, validArrangement } from './progress.js';

const puzzle = generatePuzzle(1, 'progress-test');

test('archive saves never share a key with the live daily', () => {
  assert.notEqual(beadleSaveKey('2026-09-01', true), beadleSaveKey('2026-09-01', false));
});

test('progress, undo history and counters round-trip', () => {
  const [move] = solve(puzzle.sticks);
  const after = slide(puzzle.sticks, ...move).sticks;
  const state = { sticks: after, history: [{ sticks: puzzle.sticks, moves: 0 }], moves: 1, hints: 1, seconds: 42, started: true };
  const restored = restoreBeadle(puzzle, JSON.parse(JSON.stringify(saveBeadle(puzzle, state))));
  assert.deepEqual(restored, state);
});

test('saves for another puzzle or with changed beads are ignored', () => {
  const other = generatePuzzle(1, 'another');
  const saved = saveBeadle(puzzle, { sticks: puzzle.sticks, history: [], moves: 3, hints: 0, seconds: 5, started: true });
  assert.equal(restoreBeadle(other, saved).moves, 0);
  const tampered = { ...saved, sticks: puzzle.sticks.map((stick, i) => i === 0 ? [...stick.slice(0, -1), 99] : stick) };
  assert.equal(restoreBeadle(puzzle, tampered).moves, 0);
  assert.equal(validArrangement(puzzle.sticks, [[0, 0, 0, 0, 0]]), false);
});

test('history is capped', () => {
  const history = Array.from({ length: HISTORY_LIMIT + 50 }, () => ({ sticks: puzzle.sticks, moves: 0 }));
  assert.equal(saveBeadle(puzzle, { sticks: puzzle.sticks, history, moves: 0, hints: 0, seconds: 0, started: false }).history.length, HISTORY_LIMIT);
});
