import test from 'node:test';
import assert from 'node:assert/strict';
import { feedback, hiddenPositions, visibleFeedback, keyboardFeedback } from './logic.js';

test('duplicate letters consume only the available matches, greens first', () => {
  assert.deepEqual(feedback('ALLEY', 'APPLE'), ['correct', 'present', 'absent', 'present', 'absent']);
  assert.deepEqual(feedback('EERIE', 'SHEEP'), ['present', 'present', 'absent', 'absent', 'absent']);
  assert.deepEqual(feedback('APPLE', 'APPLE'), Array(5).fill('correct'));
});

test('boards deterministically hide 5–12 cells with varying row counts and an unhidden last row', () => {
  const totals = new Set();
  const patterns = new Set();
  for (let day = 0; day < 365; day++) {
    const seed = `parshle:day:${day}`;
    const masks = Array.from({ length: 5 }, (_, row) => hiddenPositions(seed, row));
    const counts = masks.map(mask => mask.length);
    const total = counts.reduce((sum, count) => sum + count, 0);
    assert.ok(total >= 5 && total <= 12);
    assert.ok(new Set(counts).size > 1);
    assert.deepEqual(hiddenPositions(seed, 5), []);
    masks.forEach((mask, row) => {
      assert.deepEqual(mask, hiddenPositions(seed, row));
      assert.equal(new Set(mask).size, mask.length);
      assert.ok(mask.every(i => Number.isInteger(i) && i >= 0 && i < 5));
    });
    totals.add(total);
    patterns.add(JSON.stringify(masks));
  }
  assert.deepEqual([...totals].sort((a, b) => a - b), [5, 6, 7, 8, 9, 10, 11, 12]);
  assert.ok(patterns.size > 300);
});

test('the last guess has no hidden cells and reveals full feedback', () => {
  for (const seed of ['daily:2026-09-29', 'random:0.42']) {
    assert.deepEqual(hiddenPositions(seed, 5), []);
    assert.deepEqual(visibleFeedback('ALLEY', 'APPLE', seed, 5), feedback('ALLEY', 'APPLE'));
    assert.deepEqual(visibleFeedback('APPLE', 'APPLE', seed, 5), Array(5).fill('correct'));
  }
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

test('saved archive masks control both visible and keyboard feedback', () => {
  const masks = [[0, 1, 2, 3, 4], [], [], [], [], []];
  assert.deepEqual(visibleFeedback('CRANE', 'CRANE', 'changed-generator-seed', 0, masks), Array(5).fill('hidden'));
  assert.deepEqual(keyboardFeedback(['CRANE'], 'CRANE', 'changed-generator-seed', masks), {});
});
