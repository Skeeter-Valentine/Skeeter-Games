import assert from 'node:assert/strict';
import test from 'node:test';
import { nonogramProgressKey, saveNonogram, restoreNonogram } from './progress.js';

const solution = [[1, 0], [1, 1]];

test('archive progress keys are separate from the live daily', () => {
  assert.notEqual(nonogramProgressKey('2026-09-01', true), nonogramProgressKey('2026-09-01', false));
});

test('progress restores, recognises a finished grid, and ignores other puzzles', () => {
  const partial = restoreNonogram(solution, JSON.parse(JSON.stringify(saveNonogram(solution, [[1, 2], [0, 0]], true, false))));
  assert.deepEqual(partial, { grid: [[1, 2], [0, 0]], hasStarted: true, isWon: false });
  assert.equal(restoreNonogram(solution, saveNonogram(solution, [[1, 2], [1, 1]], true, true)).isWon, true);
  assert.deepEqual(restoreNonogram([[0, 1], [1, 1]], saveNonogram(solution, [[1, 0], [1, 1]], true, true)).grid, [[0, 0], [0, 0]]);
});
