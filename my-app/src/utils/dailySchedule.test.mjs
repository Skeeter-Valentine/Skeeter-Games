import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduledGames, scheduledDifficulty } from './dailySchedule.js';
import { dailyDifficulty } from './dailyDifficulty.js';
import { getDailyGridSize as shikaku } from '../games/shikaku/puzzle.js';
import { getDailyGridSize as pipes } from '../games/pipes/dailyConfig.js';
import { getDailySize as nonograms } from '../games/nonograms/dailyConfig.js';
import { getDailySize as stitches } from '../games/stitches/dailyConfig.js';
import { getDailyConfig as hashi } from '../games/hashi/dailyConfig.js';
import { getDailyBoardConfig as mines } from '../games/minesweeper/dailyConfig.js';
import { hiddenPositions } from '../games/parshle/logic.js';

test('ten years of actual daily boards meet quotas, transitions, and rating mappings', () => {
  let previous = {};
  const sizes = Object.fromEntries(scheduledGames.map(game => [game, new Set()]));
  for (let offset = 0; offset < 3660; offset++) {
    const date = new Date(Date.UTC(2026, 0, 1 + offset)).toISOString().slice(0, 10);
    const ratings = {};
    for (const game of scheduledGames) {
      const rating = dailyDifficulty(game, date);
      assert.equal(rating, scheduledDifficulty(game, date), `${game}: ${date}`);
      if (rating !== 2) assert.notEqual(previous[game], rating, `${game} repeats an extreme on ${date}`);
      ratings[game] = rating;
    }
    assert.ok(Object.values(ratings).filter(value => value === 1).length >= 2, date);
    assert.ok(Object.values(ratings).filter(value => value === 3).length >= 2, date);
    previous = ratings;
    for (const [game, size] of Object.entries({ shikaku: shikaku(date), pipes: pipes(date), nonograms: nonograms(date), stitches: stitches(date), hashi: hashi(date).size })) sizes[game].add(size);
    const board = mines(date);
    sizes.minesweeper.add(`${board.rows}x${board.cols}:${board.mines}`);
    sizes.parshle.add(Array.from({ length: 5 }, (_, row) => hiddenPositions(`parshle:${date}`, row).length).reduce((a, b) => a + b, 0));
    assert.deepEqual(hiddenPositions(`parshle:${date}`, 5), []);
  }
  for (const [game, expected] of Object.entries({ shikaku: [5, 7, 10, 15, 20], pipes: [5, 7, 9], nonograms: [5, 10, 15], stitches: [5, 7, 9], hashi: [5, 6, 7, 8], parshle: [5, 6, 7, 8, 9, 10, 11, 12] })) {
    assert.deepEqual([...sizes[game]].sort((a, b) => a - b), expected, game);
  }
  assert.deepEqual(sizes.minesweeper, new Set(['9x9:10', '12x12:22', '14x14:30', '16x16:40', '16x30:99']));
});

test('schedule is independent of lookup order and handles year and leap-day boundaries', () => {
  for (const date of ['2028-02-29', '2027-01-01', '2026-12-31', '2028-03-01']) {
    const before = scheduledGames.map(game => scheduledDifficulty(game, date));
    scheduledGames.forEach(game => scheduledDifficulty(game, '2030-01-01'));
    assert.deepEqual(scheduledGames.map(game => scheduledDifficulty(game, date)), before);
  }
  assert.throws(() => scheduledDifficulty('parshle', '2026-02-30'), RangeError);
});
