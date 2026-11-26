import assert from 'node:assert/strict';
import test from 'node:test';
import { FAIR_FROM, LINEUP_RULES_FROM, MAX_MILD, ONE_MILD_FROM, OTHER_GAMES, WORD_GAMES, addDays, gauntletLevel, lineupFor, otherGamesFor, seeded, weekStart } from './weeklyLineup.js';
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
    assert.ok(day.every(id => [...ALL, 'pepper-placer', 'kakurasu'].includes(id)));
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
  for (const [w, week] of weeks.entries()) {
    const games = otherGamesFor(addDays(LINEUP_RULES_FROM, w * 7));
    const sets = week.map(day => day.filter(id => !WORD_GAMES.includes(id)).sort().join('+'));
    assert.equal(new Set(sets).size, 7, 'a different set of puzzles every day');
    // 28 slots over 10 puzzles: eight play 3 times, two play twice. From
    // ONE_MILD_FROM, swapping out extra Mild puzzles can shift a play or two.
    const plays = games.map(game => week.filter(day => day.includes(game)).length);
    // From FAIR_FROM the spread is kept over any seven days instead (see its own test).
    const monday = addDays(LINEUP_RULES_FROM, w * 7);
    if (addDays(monday, 6) < ONE_MILD_FROM) assert.deepEqual([...plays].sort(), [2, 2, 3, 3, 3, 3, 3, 3, 3, 3]);
    else assert.ok(plays.every(count => count >= 1 && count <= 5), `week ${w}: ${plays}`);
    if (w >= 2) games.forEach((game, i) => { if (plays[i] === 2) lighter.add(game); });
  }
  // The two lighter puzzles change from week to week.
  assert.equal(lighter.size, OTHER_GAMES.length);
});

test('weeks are not all alike', () => {
  // Each Monday steers clear of the Sunday before, so Mondays vary less than
  // a free draw would, but still change from week to week.
  const firstDays = new Set(weeks.map(week => week[0].slice().sort().join('+')));
  assert.ok(firstDays.size > WEEKS * 0.4);
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

test("Add 'em Up replaces Mineskeeter from the week of 2026-11-09", () => {
  for (const [w, week] of weeks.entries()) {
    const days = week.flat();
    if (addDays(LINEUP_RULES_FROM, w * 7) < '2026-11-09') {
      assert.ok(!days.includes('kakurasu') && days.includes('minesweeper'), `week ${w}`);
    } else {
      assert.ok(days.includes('kakurasu') && !days.includes('minesweeper'), `week ${w}`);
    }
  }
});

test('from ONE_MILD_FROM, at most one single-pepper game a day', () => {
  let mildDays = 0;
  for (let day = ONE_MILD_FROM; day < '2028-12-31'; day = addDays(day, 1)) {
    const mild = lineupFor(day).filter(id => gauntletLevel(id, day) === 1).length;
    assert.ok(mild <= MAX_MILD, `${day} has ${mild} Mild games`);
    if (mild === 1) mildDays += 1;
  }
  assert.ok(mildDays > 300, 'most days still have one easy game');
});

test('from FAIR_FROM: rarely the same puzzle two days running, never three, and an even spread', async () => {
  const { FAIR_FROM } = await import('./weeklyLineup.js');
  const others = day => lineupFor(day).filter(id => !WORD_GAMES.includes(id));
  let days = 0, backToBack = 0;
  const year = {};
  // From a week after FAIR_FROM (the days before it were planned the old way).
  for (let day = addDays(FAIR_FROM, 7); day < '2028-12-31'; day = addDays(day, 1)) {
    days++;
    const today = others(day), [a, b] = [others(addDays(day, -2)), others(addDays(day, -1))];
    assert.ok(!today.some(id => a.includes(id) && b.includes(id)), `${day}: a puzzle on three days running`);
    backToBack += today.filter(id => b.includes(id)).length;
    const week = Array.from({ length: 7 }, (_, n) => others(addDays(day, -n)));
    for (const id of OTHER_GAMES) assert.ok(week.filter(list => list.includes(id)).length <= 4, `${day}: ${id} more than 4 times in 7 days`);
    if (day.startsWith('2027')) for (const id of today) year[id] = (year[id] ?? 0) + 1;
  }
  assert.ok(backToBack < days * 0.01, `${backToBack} repeats from the day before in ${days} days`);
  // Over a year, every puzzle plays about equally (146 each on average).
  for (const id of OTHER_GAMES) assert.ok(year[id] > 130 && year[id] < 160, `${id}: ${year[id]} plays in 2027`);
});
