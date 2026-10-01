import test from 'node:test';
import assert from 'node:assert/strict';
import { marathonProgress } from './progress.js';

test('loss starts only when guesses left are fewer than unsolved words', () => {
  const answers = Array.from({ length: 26 }, (_, i) => `answer${i}`);
  const misses = Array.from({ length: 6 }, (_, i) => `miss${i}`);
  assert.equal(marathonProgress(answers, [], 31).lost, false);
  assert.equal(marathonProgress(answers, misses.slice(0, 5), 31).lost, false);
  assert.deepEqual(marathonProgress(answers, misses, 31), { remainingWords: 26, remainingGuesses: 25, lost: true });
  assert.equal(marathonProgress(answers, [...misses.slice(0, 5), answers[0]], 31).lost, false);
});

test('last-guess win, exhausted budget, and overtime have correct counts', () => {
  assert.equal(marathonProgress(['APPLE'], ['APPLE'], 1).lost, false);
  assert.deepEqual(marathonProgress(['APPLE'], ['BERRY', 'PEACH'], 1), { remainingWords: 1, remainingGuesses: 0, lost: true });
  assert.equal(marathonProgress(['APPLE', 'APPLE'], [], 1).lost, false);
});

import { marathonProgressKey, saveMarathon, restoreMarathon } from './progress.js';

test('archive progress keys are separate from the live daily', () => {
  assert.notEqual(marathonProgressKey('2026-09-01', true), marathonProgressKey('2026-09-01', false));
});

test('saved marathons restore only onto the same answers', () => {
  const answers = ['APPLE', 'BERRY'];
  const state = { guesses: ['APPLE', 'CRANE', 'APPLE', 'bad'], secondsElapsed: 75, hasStarted: true,
    loss: { remainingWords: 1, remainingGuesses: 0, lost: true, seconds: 70 }, continuePlaying: true };
  const restored = restoreMarathon(answers, JSON.parse(JSON.stringify(saveMarathon(answers, state))));
  assert.deepEqual(restored.guesses, ['APPLE', 'CRANE']);
  assert.equal(restored.secondsElapsed, 75);
  assert.equal(restored.loss.seconds, 70);
  assert.equal(restored.continuePlaying, true);
  assert.deepEqual(restoreMarathon(['BERRY', 'APPLE'], saveMarathon(answers, state)).guesses, []);
});
