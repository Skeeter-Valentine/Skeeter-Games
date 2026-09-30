import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyDifficulty } from './dailyDifficulty.js';
import { getDailyGridSize } from '../games/shikaku/puzzle.js';
import { getDailyGridSize as pipesSize } from '../games/pipes/dailyConfig.js';
import { getDailyBoardConfig } from '../games/minesweeper/dailyConfig.js';
import { getDailyConfig } from '../games/hashi/dailyConfig.js';
import { mulberry32 } from '../games/hashi/puzzle.js';
import { getDailySize as nonogramsSize } from '../games/nonograms/dailyConfig.js';
import { getDailySize as stitchesSize } from '../games/stitches/dailyConfig.js';
import { hiddenPositions } from '../games/parshle/logic.js';

test('ratings match daily sizes across a year and reach all three levels', () => {
  const levels = Object.fromEntries(['pipes', 'shikaku', 'minesweeper', 'hashi', 'nonograms', 'stitches'].map(id => [id, new Set()]));
  for (let day = 0; day < 365; day++) {
    const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
    const mines = getDailyBoardConfig(date);
    const originalRng = mulberry32(parseInt(date.replaceAll('-', ''), 10));
    originalRng();
    const hashi = getDailyConfig(date);
    assert.equal(hashi.rng(), originalRng(), 'Hashi puzzle random sequence must not change');
    const expected = {
      nonograms: { 5: 1, 10: 2, 15: 3 }[nonogramsSize(date)],
      stitches: { 5: 1, 7: 2, 9: 3 }[stitchesSize(date)],
      pipes: { 5: 1, 7: 2, 9: 3 }[pipesSize(date)],
      shikaku: { 5: 1, 7: 1, 10: 2, 15: 3, 20: 3 }[getDailyGridSize(date)],
      minesweeper: { 9: 1, 12: 1, 14: 2, 16: 3 }[mines.rows],
      hashi: { 5: 1, 6: 2, 7: 2, 8: 3 }[hashi.size],
    };
    for (const [id, rating] of Object.entries(expected)) {
      assert.equal(dailyDifficulty(id, date), rating);
      levels[id].add(rating);
    }
    for (const id of ['skeedlemarathon', 'skeedlemath', 'quordle', 'word500', '2048', 'sudoku']) {
      assert.equal(dailyDifficulty(id, date), 2);
    }
  }
  for (const ratings of Object.values(levels)) assert.deepEqual([...ratings].sort(), [1, 2, 3]);
});

test('Parshle ratings match every hidden-cell count including tier boundaries', () => {
  const counts = new Set();
  const expected = { 5: 1, 6: 1, 7: 1, 8: 2, 9: 2, 10: 3, 11: 3, 12: 3 };
  for (let day = 0; day < 365; day++) {
    const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
    const count = Array.from({ length: 5 }, (_, row) => hiddenPositions(`parshle:${date}`, row).length)
      .reduce((sum, length) => sum + length, 0);
    counts.add(count);
    assert.equal(dailyDifficulty('parshle', date), expected[count]);
  }
  assert.deepEqual([...counts].sort((a, b) => a - b), [5, 6, 7, 8, 9, 10, 11, 12]);
});
