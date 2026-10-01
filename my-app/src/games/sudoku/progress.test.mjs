import assert from 'node:assert/strict';
import test from 'node:test';
import { sudokuProgressKey, saveSudoku, restoreSudoku } from './progress.js';

const solution = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];
const puzzle = [1, 0, 0, 4, 0, 4, 1, 0, 2, 0, 0, 3, 0, 3, 2, 0];

test('archive and daily progress use separate keys', () => {
  assert.notEqual(sudokuProgressKey('2026-09-01', true), sudokuProgressKey('2026-09-01', false));
});

test('progress round-trips, including notes', () => {
  const grid = [...puzzle]; grid[1] = 2;
  const notes = puzzle.map(() => new Set()); notes[2].add(3);
  const saved = JSON.parse(JSON.stringify(saveSudoku({ puzzle, grid, notes, mistakes: 1, elapsed: 30, completed: false, hasStarted: true })));
  const restored = restoreSudoku(puzzle, solution, saved);
  assert.deepEqual(restored.grid, grid);
  assert.deepEqual([...restored.notes[2]], [3]);
  assert.equal(restored.elapsed, 30);
  assert.equal(restored.completed, false);
});

test('progress for another board or overwritten givens is rejected or repaired', () => {
  const other = [...puzzle]; other[0] = 0;
  const saved = saveSudoku({ puzzle, grid: [...puzzle], notes: puzzle.map(() => new Set()), mistakes: 0, elapsed: 0, completed: false, hasStarted: false });
  assert.equal(restoreSudoku(other, solution, saved), null);
  saved.grid[0] = 9;
  assert.equal(restoreSudoku(puzzle, solution, saved).grid[0], 1);
});

test('a finished grid restores as completed', () => {
  const saved = saveSudoku({ puzzle, grid: [...solution], notes: puzzle.map(() => new Set()), mistakes: 0, elapsed: 90, completed: true, hasStarted: true });
  assert.equal(restoreSudoku(puzzle, solution, saved).completed, true);
});
