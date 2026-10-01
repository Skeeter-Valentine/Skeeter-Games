import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyPuzzle, getEdges } from './puzzle.js';
import { storageKey, restoreProgress } from './progress.js';
import { readLocal, writeLocal } from '../../utils/dailyStats.js';

test('Skitches archive saves cannot overwrite daily or another date', () => {
  const date = '2026-09-29', puzzle = dailyPuzzle(date);
  const saved = { fingerprint: JSON.stringify(puzzle), selected: [getEdges(puzzle.regions)[0].id], marks: [0], seconds: 19 };
  writeLocal(storageKey(date), saved);
  writeLocal(storageKey(date, true), { ...saved, selected: [], seconds: 40 });
  assert.equal(restoreProgress(puzzle, readLocal(storageKey(date), null)).seconds, 19);
  assert.equal(restoreProgress(puzzle, readLocal(storageKey(date, true), null)).seconds, 40);
  assert.equal(readLocal(storageKey('2026-09-28', true), null), null);
  assert.equal(restoreProgress(puzzle, saved).started, true);
  assert.deepEqual(restoreProgress(puzzle, { ...saved, fingerprint: 'old' }).selected, []);
  assert.deepEqual(restoreProgress(puzzle, { ...saved, selected: ['invalid-edge'] }).selected, []);
});
