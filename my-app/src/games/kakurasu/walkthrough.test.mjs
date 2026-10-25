import assert from 'node:assert/strict';
import test from 'node:test';
import { countSolutions, evaluateBoard } from './puzzle.js';
import { TUTORIAL_PUZZLE, TUTORIAL_STEPS, lineDeduction } from './walkthrough.js';

test('the tutorial board has one solution', () => {
  assert.equal(countSolutions(TUTORIAL_PUZZLE), 1);
});

test('each step is exactly what its row or column proves, and the steps solve the board', () => {
  const grid = Array(16).fill(0);
  for (const step of TUTORIAL_STEPS) {
    const proved = lineDeduction(TUTORIAL_PUZZLE, grid, step.kind, step.index);
    assert.deepEqual(proved, { shade: step.shade, clear: step.clear }, `${step.kind} ${step.index}`);
    assert.ok(step.shade.length || step.clear.length);
    step.shade.forEach(id => { grid[id] = 1; });
    step.clear.forEach(id => { grid[id] = 2; });
  }
  const shaded = grid.flatMap((value, id) => value === 1 ? [id] : []);
  assert.ok(evaluateBoard(TUTORIAL_PUZZLE, shaded).won);
});
