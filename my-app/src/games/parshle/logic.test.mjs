import test from 'node:test';
import assert from 'node:assert/strict';
import { feedback, hiddenPositions, visibleFeedback, keyboardFeedback } from './logic.js';

test('duplicate letters consume only the available matches, greens first', () => {
  assert.deepEqual(feedback('ALLEY', 'APPLE'), ['correct', 'present', 'absent', 'present', 'absent']);
  assert.deepEqual(feedback('EERIE', 'SHEEP'), ['present', 'present', 'absent', 'absent', 'absent']);
  assert.deepEqual(feedback('APPLE', 'APPLE'), Array(5).fill('correct'));
});

test('masks are deterministic and hide exactly two distinct positions each row', () => {
  const patterns = new Set();
  for (let day = 0; day < 365; day++) for (let row = 0; row < 6; row++) {
    const mask = hiddenPositions(`day:${day}`, row);
    assert.deepEqual(mask, hiddenPositions(`day:${day}`, row));
    assert.equal(new Set(mask).size, 2);
    assert.ok(mask.every(i => i >= 0 && i < 5));
    patterns.add([...mask].sort().join(''));
  }
  assert.equal(patterns.size, 10);
});

test('keyboard cannot leak hidden feedback, and retains strongest revealed evidence', () => {
  const seed = 'test';
  const colors = visibleFeedback('CRANE', 'CRANE', seed, 0);
  const keys = keyboardFeedback(['CRANE'], 'CRANE', seed);
  [...'CRANE'].forEach((letter, i) => assert.equal(keys[letter], colors[i] === 'hidden' ? undefined : 'correct'));
  const guesses = ['CRANE', 'SLATE', 'CRANE'];
  const combined = keyboardFeedback(guesses, 'CRANE', seed);
  const rank = { absent: 1, present: 2, correct: 3 };
  guesses.forEach((guess, row) => visibleFeedback(guess, 'CRANE', seed, row).forEach((color, i) => {
    if (color !== 'hidden') assert.ok(rank[combined[guess[i]]] >= rank[color]);
  }));
});
