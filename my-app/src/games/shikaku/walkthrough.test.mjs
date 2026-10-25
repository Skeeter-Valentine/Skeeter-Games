import assert from 'node:assert/strict';
import test from 'node:test';
import { countSolutions } from './solver.js';
import { TUTORIAL_CLUES, TUTORIAL_WORDS, shikakuWalkthrough } from './walkthrough.js';

test('the tutorial board has one solution', () => {
  assert.equal(countSolutions(TUTORIAL_CLUES), 1);
});

test('the walkthrough covers the board with the basic moves, in the order its words describe', () => {
  const steps = shikakuWalkthrough(TUTORIAL_CLUES);
  assert.deepEqual(steps.map(step => `${step.reason} ${step.area}`), ['onlyFit 5', 'onlyReach 6', 'onlyFit 6', 'onlyFit 4', 'onlyFit 2', 'onlyFit 2']);
  assert.equal(steps.length, TUTORIAL_WORDS.length);
  assert.deepEqual(steps[1].cell, [3, 0]);
  const cells = steps.reduce((sum, { rect }) => sum + (rect.r2 - rect.r1 + 1) * (rect.c2 - rect.c1 + 1), 0);
  assert.equal(cells, 25);
});
