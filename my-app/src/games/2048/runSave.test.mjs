import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeRun, validateRun } from './runSave.js';
const run = {
  version: 1, gameMode: 'classic', date: '2026-09-27', unlimitedSeed: 42,
  tiles: [{ id: 9, r: 0, c: 2, value: 2048 }], score: 3000, undoCount: 2,
  elapsedTime: 150, gameWon: true, completionTimeKnown: true,
  history: [{ tiles: [{ id: 4, r: 1, c: 2, value: 1024 }], score: 1000 }],
};
test('cloud snapshot preserves board, mode, timer and undo history', () => {
  for (const gameMode of ['daily', 'classic', 'unlimited']) {
    const decoded = validateRun(JSON.parse(encodeRun({ ...run, gameMode })));
    assert.equal(decoded.gameMode, gameMode);
    assert.equal(decoded.elapsedTime, 150);
    assert.equal(decoded.score, 3000);
    assert.equal(decoded.history[0].tiles[0].value, 1024);
    assert.equal(decoded.tiles[0].id, 9);
    assert.equal(decoded.undoCount, 2);
  }
});
test('invalid and oversized snapshots are rejected', () => {
  for (const change of [{ version: 2 }, { score: NaN }, { elapsedTime: -1 }, { gameMode: 'bad' },
    { tiles: [...run.tiles, ...run.tiles] }, { tiles: [{ id: 1, r: 4, c: 0, value: 2 }] },
    { tiles: [{ id: 1, r: 0, c: 0, value: 3 }] }, { history: [{}] }]) {
    assert.throws(() => encodeRun({ ...run, ...change }));
  }
  assert.throws(() => encodeRun({ ...run, history: Array(12000).fill(run.history[0]) }), /too much undo history/);
});
