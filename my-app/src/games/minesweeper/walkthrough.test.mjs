import assert from 'node:assert/strict';
import test from 'node:test';
import { TUTORIAL_MINES, TUTORIAL_SIZE, TUTORIAL_START, TUTORIAL_WORDS, counts, mineWalkthrough } from './walkthrough.js';

test('the walkthrough clears the tutorial board with the two basic moves, in the order its words describe', () => {
  const numbers = counts(TUTORIAL_SIZE, TUTORIAL_MINES);
  assert.equal(numbers[TUTORIAL_START], 0);
  const steps = mineWalkthrough(TUTORIAL_SIZE, TUTORIAL_MINES, TUTORIAL_START);
  assert.deepEqual(steps.map(step => `${step.action} ${step.number}`), ['flag 1', 'dig 1', 'flag 1', 'flag 3', 'dig 2', 'dig 1']);
  assert.equal(steps.length, TUTORIAL_WORDS.length);
  for (const step of steps) {
    assert.equal(step.targets.length, 1);
    assert.equal(TUTORIAL_MINES.includes(step.targets[0]), step.action === 'flag');
    // Digging never opens a 0, so each step changes exactly the square tapped.
    if (step.action === 'dig') assert.notEqual(numbers[step.targets[0]], 0);
  }
});
