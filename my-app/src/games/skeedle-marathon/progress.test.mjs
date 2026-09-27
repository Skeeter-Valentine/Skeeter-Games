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
