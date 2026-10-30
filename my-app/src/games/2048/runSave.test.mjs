import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SAVED_HISTORY, encodeBoard, encodeRun, validateRun } from './runSave.js';
const run = {
  version: 1, gameMode: 'classic', date: '2026-09-27', unlimitedSeed: 42,
  tiles: [{ id: 9, r: 0, c: 2, value: 2048 }], score: 3000, undoCount: 2,
  elapsedTime: 150, gameWon: true, completionTimeKnown: true,
  history: [{ tiles: [{ id: 4, r: 1, c: 2, value: 1024 }], score: 1000 }],
};
test('cloud snapshot preserves board, mode, timer and undo history', () => {
  for (const gameMode of ['daily', 'classic', 'unlimited']) {
    const decoded = validateRun(JSON.parse(encodeRun({ ...run, gameMode }).payload));
    assert.equal(decoded.gameMode, gameMode);
    assert.equal(decoded.elapsedTime, 150);
    assert.equal(decoded.score, 3000);
    assert.equal(decoded.history[0].tiles[0].value, 1024);
    assert.deepEqual(decoded.tiles.map(({ r, c, value }) => ({ r, c, value })), [{ r: 0, c: 2, value: 2048 }]);
    assert.equal(decoded.history[0].score, 1000);
    assert.equal(decoded.undoCount, 2);
  }
});
test('invalid snapshots are rejected', () => {
  for (const change of [{ version: 3 }, { score: NaN }, { elapsedTime: -1 }, { gameMode: 'bad' },
    { tiles: [...run.tiles, ...run.tiles] }, { tiles: [{ id: 1, r: 4, c: 0, value: 2 }] },
    { tiles: [{ id: 1, r: 0, c: 0, value: 3 }] }, { history: [{}] }]) {
    assert.throws(() => encodeRun({ ...run, ...change }));
  }
});

test('boards are 16 characters, and long runs keep their most recent undo steps', () => {
  assert.equal(encodeBoard([{ r: 0, c: 0, value: 2 }, { r: 3, c: 3, value: 131072 }]), '100000000000000h');
  const full = Array.from({ length: 16 }, (_, i) => ({ id: i + 1, r: Math.floor(i / 4), c: i % 4, value: 2 ** (i % 11 + 1) }));
  // 30,000 full boards: about 30 MB as plain JSON.
  const history = Array.from({ length: 30000 }, (_, i) => ({ tiles: full, score: i }));
  const { payload, kept, dropped } = encodeRun({ ...run, tiles: full, history });
  assert.ok(new TextEncoder().encode(payload).length <= 800000);
  assert.equal(kept, MAX_SAVED_HISTORY);
  assert.equal(dropped, 10000);
  const decoded = validateRun(JSON.parse(payload));
  assert.equal(decoded.history.length, MAX_SAVED_HISTORY);
  assert.equal(decoded.history.at(-1).score, 29999, 'the newest steps are the ones kept');
  assert.equal(decoded.history[0].tiles.length, 16);
  // Every tile id is unique across the board and its history.
  const ids = [...decoded.tiles, ...decoded.history.slice(0, 50).flatMap(step => step.tiles)].map(tile => tile.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('runs saved in the old format still load', () => {
  const old = JSON.stringify({ ...run, history: run.history.map(step => ({ ...step, tiles: step.tiles.map(t => ({ ...t, isMerged: false, distance: 0 })) })) });
  assert.equal(validateRun(JSON.parse(old)).tiles[0].value, 2048);
});
