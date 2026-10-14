import assert from 'node:assert/strict';
import test from 'node:test';
import { syncShared } from '../scripts/sync-functions-shared.mjs';
import { applyEvent } from './gauntlet.js';

// functions/shared is generated from the site's code; refresh it first.
syncShared();
const { GAUNTLET_BONUS, dailyPeppers, gauntletGamePeppers, gauntletPeppers, pepperWeek } = await import('./peppers.js');

test('pepper weeks start Monday at 4am Colorado time', () => {
  const week = iso => pepperWeek(Date.parse(iso));
  assert.equal(week('2026-10-12T10:00:00Z'), '2026-10-12'); // Mon 4:00am MDT
  assert.equal(week('2026-10-12T09:59:00Z'), '2026-10-05'); // Mon 3:59am: still last week
  assert.equal(week('2026-10-18T23:00:00Z'), '2026-10-12'); // Sunday evening
  assert.equal(week('2026-10-19T09:59:00Z'), '2026-10-12');
  assert.equal(week('2026-11-02T11:00:00Z'), '2026-11-02'); // after clocks fall back
});

test('the homepage asks for the same week the server writes', async () => {
  const client = await import('../src/gauntlet/gauntlet.js');
  for (let hour = 0; hour < 24 * 400; hour += 7) {
    const now = Date.UTC(2026, 9, 1) + hour * 3600000;
    assert.equal(client.pepperWeek(now), pepperWeek(now));
  }
});

test('daily wins earn the chili rating, once, for today\'s puzzle only', async () => {
  const { dailyDifficulty } = await import('../src/utils/dailyDifficulty.js');
  const now = Date.parse('2026-10-13T18:00:00Z');
  for (const game of ['parshle', 'pipes', 'hashi', 'map', 'quordle']) {
    assert.equal(dailyPeppers({ game, date: '2026-10-13', mode: 'daily', status: 'won' }, true, now), dailyDifficulty(game, '2026-10-13'));
  }
  assert.equal(dailyPeppers({ game: 'pipes', date: '2026-10-12', mode: 'daily', status: 'won' }, true, now), dailyDifficulty('pipes', '2026-10-12'));
  assert.equal(dailyPeppers({ game: 'pipes', date: '2026-10-11', mode: 'daily', status: 'won' }, true, now), 0);
  assert.equal(dailyPeppers({ game: 'pipes', date: '2026-10-13', mode: 'daily', status: 'won' }, false, now), 0, 'only the first win');
  assert.equal(dailyPeppers({ game: 'pipes', date: '2026-10-13', mode: 'daily', status: 'lost' }, true, now), 0);
  assert.equal(dailyPeppers({ game: 'pipes', date: '2026-10-01', mode: 'archive', status: 'won' }, true, now), 0);
});

test('gauntlet games earn the same chili ratings the page shows, plus 5 for finishing', async () => {
  const { gauntletLineup } = await import('../src/gauntlet/gauntlet.js');
  const day = '2026-10-13', now = Date.parse('2026-10-13T18:00:00Z');
  const lineup = gauntletLineup(day);
  for (const game of lineup) assert.equal(gauntletGamePeppers(day, game.id), game.level);
  let { run } = applyEvent(null, { action: 'start', day }, now);
  let total = 0, entry;
  for (const [index, game] of lineup.entries()) {
    if (index) ({ run } = applyEvent(run, { action: 'next', day }, now + index * 100_000));
    ({ run, entry } = applyEvent(run, { action: 'finish', day, game: game.id, status: index === 2 ? 'gave-up' : 'won', penalty: 60 }, now + index * 100_000 + 60_000));
    total += gauntletPeppers(day, run, !!entry);
  }
  const expected = lineup.filter((_, index) => index !== 2).reduce((sum, game) => sum + game.level, 0) + GAUNTLET_BONUS;
  assert.equal(total, expected);
  assert.equal(gauntletPeppers('2099-01-01', run, true), 0, 'test gauntlets never count');
});
