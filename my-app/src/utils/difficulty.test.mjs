import assert from 'node:assert/strict';
import test from 'node:test';
import { TIME_BUCKETS, combineRates, medianFromBuckets, puzzleSummary, rankPuzzles } from './difficulty.js';
import { TIME_BUCKETS as SERVER_BUCKETS } from '../../functions/attempts.js';

test('client and server use the same time buckets', () => {
  assert.deepEqual(TIME_BUCKETS, SERVER_BUCKETS);
});

test('daily and archive counters combine', () => {
  const total = combineRates([{ starts: 3, wins: 2, timedWins: 2, winSeconds: 100, timeBuckets: { b1: 2 } }, { starts: 1, wins: 1, timedWins: 1, winSeconds: 50, timeBuckets: { b1: 1 } }, null]);
  assert.deepEqual(total, { starts: 4, wins: 3, losses: 0, timedWins: 3, winSeconds: 150, timeBuckets: { b1: 3 } });
});

test('median is estimated within the middle bucket', () => {
  assert.equal(medianFromBuckets({}), null);
  assert.equal(medianFromBuckets({ b0: 1, b2: 1 }), 30); // halfway point falls at the top of the first bucket
  assert.equal(medianFromBuckets({ b4: 4 }), 240);       // 180-300 bucket, middle
  assert.equal(medianFromBuckets({ b12: 2 }), 5400);      // open-ended last bucket
});

test('summary reports completion and average time', () => {
  const s = puzzleSummary({ starts: 10, wins: 8, losses: 1, timedWins: 8, winSeconds: 800, timeBuckets: { b2: 8 } });
  assert.equal(s.completion, 0.8); assert.equal(s.averageSeconds, 100); assert.equal(s.unfinished, 1); assert.equal(s.medianSeconds, 90);
});

test('slow, rarely finished puzzles rank hardest; unplayed puzzles fall back to chili', () => {
  const rates = (starts, wins, bucket) => ({ starts, wins, losses: 0, timedWins: wins, winSeconds: wins * 100, timeBuckets: { [bucket]: wins } });
  const ranked = rankPuzzles([
    { date: '2026-09-01', chili: 2, rates: rates(40, 38, 'b2') },
    { date: '2026-09-02', chili: 2, rates: rates(40, 20, 'b8') },
    { date: '2026-09-03', chili: 2, rates: rates(40, 36, 'b4') },
    { date: '2026-09-04', chili: 3, rates: null },
    { date: '2026-09-05', chili: 1, rates: null },
  ]);
  const byDate = Object.fromEntries(ranked.map(row => [row.date, row]));
  assert.equal(byDate['2026-09-02'].rank, 1);
  assert.ok(byDate['2026-09-01'].score < byDate['2026-09-03'].score);
  assert.equal(byDate['2026-09-04'].score, 1);
  assert.equal(byDate['2026-09-05'].confidence, 'none');
  assert.deepEqual(ranked.map(r => r.rank).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});

test('a puzzle with only a couple of players stays close to its chili rating', () => {
  const ranked = rankPuzzles([
    { date: '2026-09-01', chili: 1, rates: { starts: 2, wins: 0 } },
    { date: '2026-09-02', chili: 2, rates: { starts: 50, wins: 45 } },
    { date: '2026-09-03', chili: 2, rates: { starts: 50, wins: 40 } },
  ]);
  assert.ok(Math.abs(ranked[0].score - -1) < 1);
  assert.equal(ranked[0].confidence, 'low');
});
