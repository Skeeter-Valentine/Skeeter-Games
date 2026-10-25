import assert from 'node:assert/strict';
import test from 'node:test';
import { countSolutions } from './solver.js';
import { TUTORIAL_ISLANDS, TUTORIAL_WORDS, hashiWalkthrough } from './walkthrough.js';

test('the tutorial board has one solution', () => {
  assert.equal(countSolutions(TUTORIAL_ISLANDS), 1);
});

test('the walkthrough solves the tutorial board with the basic moves, in the order its words describe', () => {
  const steps = hashiWalkthrough(TUTORIAL_ISLANDS);
  assert.deepEqual(steps.map(step => step.reason), ['full', 'atLeast', 'isolation', 'full']);
  assert.equal(steps.length, TUTORIAL_WORDS.length);
  assert.deepEqual(steps.map(step => step.targets), [['0-1', '0-1', '0-2', '0-2'], ['2-4'], ['2-3'], ['4-5']]);
});
