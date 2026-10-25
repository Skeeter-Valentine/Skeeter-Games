import assert from 'node:assert/strict';
import test from 'node:test';
import { GROUPS, TUTORIAL_PUZZLE, TUTORIAL_SOLUTION, TUTORIAL_STEPS, explains } from './walkthrough.js';

test('the tutorial solution is a valid 4 x 4 sudoku and matches the clues', () => {
  for (const group of GROUPS) assert.deepEqual(group.cells.map(id => TUTORIAL_SOLUTION[id]).sort(), [1, 2, 3, 4]);
  TUTORIAL_PUZZLE.forEach((value, id) => { if (value) assert.equal(value, TUTORIAL_SOLUTION[id]); });
});

test('every step is a fair deduction at its turn, and the steps fill the board', () => {
  const grid = [...TUTORIAL_PUZZLE];
  for (const step of TUTORIAL_STEPS) {
    assert.ok(explains(grid, step), `${step.reason} at ${step.cell}`);
    assert.equal(step.digit, TUTORIAL_SOLUTION[step.cell]);
    grid[step.cell] = step.digit;
  }
  assert.deepEqual(grid, TUTORIAL_SOLUTION);
  assert.deepEqual(new Set(TUTORIAL_STEPS.map(step => step.reason)), new Set(['lastInGroup', 'onlySpot', 'onlyNumber']));
});
