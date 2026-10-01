import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreProgress } from './progress.js';
test('restores incomplete rectangles and derives completion rather than trusting saved wins', () => {
  const clues = [[4, 0], [0, 0]];
  const incorrect = [{ r1: 0, r2: 0, c1: 0, c2: 1 }];
  const restored = restoreProgress(clues, { placedRects: incorrect, seconds: 8, isWin: true });
  assert.deepEqual(restored.placedRects, incorrect);
  assert.equal(restored.isWin, false);
  assert.equal(restored.seconds, 8);
  assert.equal(restoreProgress(clues, { placedRects: [{ r1: 0, r2: 1, c1: 0, c2: 1 }] }).isWin, true);
  assert.deepEqual(restoreProgress(clues, { placedRects: [{ r1: -1, r2: 1, c1: 0, c2: 1 }] }).placedRects, []);
  assert.deepEqual(restoreProgress(clues, { placedRects: incorrect, fingerprint: 'old puzzle' }).placedRects, []);
});
