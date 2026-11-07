import assert from 'node:assert/strict';
import test from 'node:test';
import { clockRunning } from './clockRunning.js';

test('dailies run from load; practice waits for the first move', () => {
  assert.equal(clockRunning({ daily: true, moved: false, done: false }), true);
  assert.equal(clockRunning({ daily: false, moved: false, done: false }), false);
  assert.equal(clockRunning({ daily: false, moved: true, done: false }), true);
});

test('the clock pauses when solved, learning, offering the walkthrough or hidden', () => {
  const daily = { daily: true, moved: true, done: false };
  assert.equal(clockRunning({ ...daily, done: true }), false);
  assert.equal(clockRunning({ ...daily, learning: true }), false);
  assert.equal(clockRunning({ ...daily, visible: false }), false);
  // The first-visit offer holds a daily that hasn't been touched yet.
  assert.equal(clockRunning({ daily: true, moved: false, done: false, promptOpen: true }), false);
});
