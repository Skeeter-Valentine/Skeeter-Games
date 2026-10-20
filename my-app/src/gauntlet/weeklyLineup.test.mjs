import assert from 'node:assert/strict';
import test from 'node:test';
import { LINEUP_RULES_FROM, OTHER_GAMES, WORD_GAMES, addDays, lineupFor, seeded, weekStart } from './weeklyLineup.js';
import { gauntletLineup } from './gauntlet.js';
import { lineupIds } from '../../functions/gauntlet.js';

// The rule used before LINEUP_RULES_FROM, copied here so past gauntlets can
// be checked to never change.
const ALL = ['akari', 'skeedle-beadle', 'map', 'parshle', 'stitches', 'nonograms', 'skeedlemath', 'pipes', 'shikaku', 'quordle', 'word500', 'minesweeper', 'hashi'];
function oldLineup(day) {
  const rng = seeded(`skeeter-gauntlet-v2:${day}`);
  const shuffle = list => { const items = [...list]; for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; } return items; };
  return shuffle([...shuffle(ALL.filter(id => WORD_GAMES.includes(id))).slice(0, 2), ...shuffle(ALL.filter(id => !WORD_GAMES.includes(id))).slice(0, 4)]);
}

test('gauntlets before the weekly plan keep their original games', () => {
  for (let day = '2026-01-01'; day < LINEUP_RULES_FROM; day = addDays(day, 1)) assert.deepEqual(lineupFor(day), oldLineup(day), day);
  assert.equal(weekStart(LINEUP_RULES_FROM), LINEUP_RULES_FROM, 'the plan starts on a Monday');
});

const WEEKS = 104;
const weeks = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (__, d) => lineupFor(addDays(LINEUP_RULES_FROM, w * 7 + d))));

test('every day has six different games: two word games and four others', () => {
  for (const day of weeks.flat()) {
    assert.equal(new Set(day).size, 6);
    assert.equal(day.filter(id => WORD_GAMES.includes(id)).length, 2);
    assert.ok(day.every(id => [...ALL, 'pepper-placer'].includes(id)));
  }
});

test('each week every word game plays 3 or 4 times, in different pairs', () => {
  for (const week of weeks) {
    const pairs = week.map(day => day.filter(id => WORD_GAMES.includes(id)).sort().join('+'));
    for (const game of WORD_GAMES) {
      const plays = week.filter(day => day.includes(game)).length;
      assert.ok(plays >= 3 && plays <= 4, `${game} played ${plays} times`);
    }
    assert.equal(new Set(pairs).size, 6, 'all six pairs used, one repeated');
    pairs.slice(1).forEach((pair, d) => assert.notEqual(pair, pairs[d], 'no pair two days running'));
  }
});

test('each week the other puzzles are a new set every day, spread evenly', () => {
  assert.equal(OTHER_GAMES.length, 10);
  assert.ok(OTHER_GAMES.includes('pepper-placer'));
  const lighter = new Set();
  for (const week of weeks) {
    const sets = week.map(day => day.filter(id => !WORD_GAMES.includes(id)).sort().join('+'));
    assert.equal(new Set(sets).size, 7, 'a different set of puzzles every day');
    // 28 slots over 10 puzzles: eight play 3 times, two play twice.
    const plays = OTHER_GAMES.map(game => week.filter(day => day.includes(game)).length);
    assert.deepEqual([...plays].sort(), [2, 2, 3, 3, 3, 3, 3, 3, 3, 3]);
    OTHER_GAMES.forEach((game, i) => { if (plays[i] === 2) lighter.add(game); });
  }
  // The two lighter puzzles change from week to week.
  assert.equal(lighter.size, OTHER_GAMES.length);
});

test('weeks are not all alike', () => {
  const firstDays = new Set(weeks.map(week => week[0].slice().sort().join('+')));
  assert.ok(firstDays.size > WEEKS * 0.9);
  // Games can play on consecutive days (no every-other-day pattern).
  const days = weeks.flat();
  assert.ok(days.slice(1).some((day, i) => day.some(id => days[i].includes(id))));
});

test('the site and the server always agree on the games', () => {
  for (let day = '2026-09-01'; day < '2027-12-31'; day = addDays(day, 1)) {
    assert.deepEqual(gauntletLineup(day).map(game => game.id), lineupIds(day), day);
  }
  for (let n = 0; n < 9; n++) {
    const day = addDays('2099-01-01', n);
    assert.deepEqual(gauntletLineup(day).map(game => game.id), lineupIds(day), day);
  }
});
