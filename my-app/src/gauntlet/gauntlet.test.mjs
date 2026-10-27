import assert from 'node:assert/strict';
import test from 'node:test';
import { WORD_GAMES, fromServerRun, remainingPenalty, TEST_GAUNTLETS, testDay, isTestDay, gauntletLaunched, GAUNTLET_START, gauntletDay, gauntletOpensAt, nextGauntletAt, parRecord, parVerdict, paceVersusPar, validPar, PAR_NAME, GAUNTLET_GAMES, GAUNTLET_SIZE, averageSolveSeconds, addToHistory, currentGameSeconds, gauntletLineup, gauntletPuzzleDate,
  historySummary, newRun, recordResult, restoreRun, runTotal, shareText, startNextGame, formatClock } from './gauntlet.js';
import { dailyDifficulty } from '../utils/dailyDifficulty.js';

test('every game except Skeedoku, 2048 and Skeedle Marathon can appear, six a day, same for everyone', () => {
  assert.equal(GAUNTLET_GAMES.length, 14);
  for (const id of ['sudoku', '2048', 'skeedle-marathon']) assert.ok(!GAUNTLET_GAMES.some(game => game.id === id), id);
  const seen = new Set();
  for (let day = 0; day < 120; day++) {
    const date = new Date(Date.UTC(2026, 9, 9 + day)).toISOString().slice(0, 10);
    const lineup = gauntletLineup(date);
    assert.equal(lineup.length, GAUNTLET_SIZE);
    assert.equal(new Set(lineup.map(game => game.id)).size, GAUNTLET_SIZE);
    assert.deepEqual(gauntletLineup(date), lineup);
    lineup.forEach(game => { seen.add(game.id); assert.ok([1, 2, 3].includes(game.level)); });
    assert.equal(lineup.filter(game => WORD_GAMES.includes(game.id)).length, 2, `two word games on ${date}`);
  }
  assert.equal(seen.size, 14);
  assert.notDeepEqual(gauntletLineup('2026-10-09'), gauntletLineup('2026-10-10'));
});

test('gauntlet puzzles use a date no daily or archive puzzle can reach', () => {
  assert.equal(gauntletPuzzleDate('2026-10-09'), '2081-07-12');
  assert.equal(gauntletPuzzleDate('2028-02-29').length, 10);
  assert.throws(() => gauntletPuzzleDate('2026-02-30'));
  assert.ok(gauntletPuzzleDate('2026-10-09') > '2070-01-01');
});

test('penalty uses community averages for the same spice level, else the estimate', () => {
  const level = dailyDifficulty('pipes', '2026-10-01');
  const same = { mode: 'daily', date: '2026-10-01', timedWins: 4, winSeconds: 400 };
  // Estimates and community averages are rounded to the nearest minute.
  assert.deepEqual(averageSolveSeconds('pipes', level, [same]), { seconds: [60, 180, 360][level - 1], source: 'estimate' });
  const more = { mode: 'daily', date: '2026-10-01', timedWins: 6, winSeconds: 1200 };
  assert.deepEqual(averageSolveSeconds('pipes', level, [same, more]), { seconds: 180, source: 'community' });
  // Archive plays and other spice levels are ignored.
  const other = ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'].find(date => dailyDifficulty('pipes', date) !== level);
  assert.equal(averageSolveSeconds('pipes', level, [{ ...more, date: other }, { ...more, mode: 'archive' }]).source, 'estimate');
  assert.equal(averageSolveSeconds('unknown', 2).seconds, 240);
});

test('a run records wins, losses with the average penalty, and waits between games', () => {
  const t = 1_000_000;
  let run = newRun('2026-10-09', t);
  const [first, second] = run.lineup;
  assert.equal(recordResult(run, { gameId: second, status: 'won', now: t + 5000 }), run, 'only the current game counts');
  run = recordResult(run, { gameId: first, status: 'won', now: t + 65_000 });
  assert.deepEqual(run.results[0], { game: first, status: 'won', seconds: 65, penalty: 0, hintPenalty: 0, bonus: 0, total: 65 });
  assert.equal(run.waiting, true);
  assert.equal(recordResult(run, { gameId: second, status: 'won', now: t + 70_000 }), run, 'nothing counts while waiting');
  assert.equal(currentGameSeconds(run, t + 999_000), 0);
  run = startNextGame(run, t + 200_000);
  assert.equal(currentGameSeconds(run, t + 230_000), 30);
  run = recordResult(run, { gameId: second, status: 'gave-up', now: t + 230_000, penalty: 180 });
  // A 3:00 penalty after 0:30 of play: 2:30 left, so the game costs 3:00 in total.
  assert.deepEqual(run.results[1], { game: second, status: 'gave-up', seconds: 30, penalty: 150, hintPenalty: 0, bonus: 0, total: 180 });
  assert.equal(runTotal(run), 245);
  for (const id of run.lineup.slice(2)) { run = startNextGame(run, t); run = recordResult(run, { gameId: id, status: 'lost', now: t + 10_000, penalty: 50 }); }
  assert.ok(run.finishedAt);
  assert.equal(run.waiting, false);
  assert.equal(recordResult(run, { gameId: run.lineup[5], status: 'won', now: t }), run);
  assert.match(shareText(run), /Skeeter Gauntlet · Oct 9\n⏱ 7:25 · 1\/6 solved\n🟩🟥🟥🟥🟥🟥\nhttps:\/\/skeetergames.org\/gauntlet/);
});

test('saved runs are validated and history tracks best time and streaks', () => {
  const run = newRun('2026-10-09', 5);
  assert.deepEqual(restoreRun(JSON.parse(JSON.stringify(run)), '2026-10-09'), run);
  assert.equal(restoreRun(run, '2026-10-10'), null);
  assert.equal(restoreRun({ ...run, lineup: [...run.lineup].reverse() }, '2026-10-09'), null);
  assert.equal(restoreRun({ ...run, index: 2 }, '2026-10-09'), null);
  let history = {};
  const finish = (date, total) => ({ date, finishedAt: 1, results: [{ status: 'won', total }], lineup: [] });
  history = addToHistory(history, finish('2026-10-09', 900));
  history = addToHistory(history, finish('2026-10-10', 700));
  history = addToHistory(history, finish('2026-10-12', 800));
  assert.deepEqual(historySummary(history, '2026-10-12'), { played: 3, bestTime: 700, streak: 1, maxStreak: 2 });
  assert.equal(historySummary(history, '2026-10-11').streak, 2);
  assert.equal(historySummary(history, '2026-10-14').streak, 0);
  assert.equal(formatClock(3725), '1:02:05');
  assert.equal(formatClock(65), '1:05');
});

test('gauntlet days start at 4am Denver time, through daylight saving changes', () => {
  const day = iso => gauntletDay(Date.parse(iso));
  assert.equal(day('2026-10-09T09:59:00Z'), '2026-10-08'); // 3:59am MDT
  assert.equal(day('2026-10-09T10:00:00Z'), '2026-10-09'); // 4:00am MDT
  assert.equal(day('2026-11-01T10:59:00Z'), '2026-10-31'); // 3:59am MST, the morning clocks fall back
  assert.equal(day('2026-11-01T11:00:00Z'), '2026-11-01');
  assert.equal(day('2027-03-14T09:59:00Z'), '2027-03-13'); // the morning clocks spring forward
  assert.equal(day('2027-03-14T10:00:00Z'), '2027-03-14');
  assert.equal(new Date(gauntletOpensAt('2026-10-09')).toISOString(), '2026-10-09T10:00:00.000Z');
  assert.equal(new Date(gauntletOpensAt('2026-12-15')).toISOString(), '2026-12-15T11:00:00.000Z');
  assert.equal(new Date(nextGauntletAt('2026-10-31')).toISOString(), '2026-11-01T11:00:00.000Z');
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.UTC(2026, 9, 9 + i)).toISOString().slice(0, 10);
    assert.equal(gauntletDay(gauntletOpensAt(d)), d);
    assert.equal(gauntletDay(gauntletOpensAt(d) - 1000), new Date(Date.UTC(2026, 9, 8 + i)).toISOString().slice(0, 10));
  }
});

test('the owner\'s time: only a full, matching run is shown, with pace and verdict', () => {
  const t = 0;
  let run = newRun('2026-10-09', t);
  for (const [i, id] of run.lineup.entries()) { run = startNextGame(run, t); run = recordResult(run, { gameId: id, status: i === 2 ? 'gave-up' : 'won', now: t + 100_000, penalty: 200 }); }
  const par = parRecord(run);
  assert.equal(par.total, 5 * 100 + 200);
  assert.equal(par.solved, 5);
  assert.deepEqual(validPar(par, '2026-10-09'), par);
  assert.equal(validPar(par, '2026-10-10'), null);
  assert.equal(validPar({ ...par, games: [...par.games].reverse() }, '2026-10-09'), null);
  assert.equal(validPar({ ...par, total: -1 }, '2026-10-09'), null);
  assert.equal(parVerdict(700, 800), `Beat ${PAR_NAME} by 1:40 🏆`);
  assert.equal(parVerdict(900, 800), `${PAR_NAME} wins by 1:40`);
  assert.equal(parVerdict(800, 800), `Tied with ${PAR_NAME}!`);
  let mine = newRun('2026-10-09', t);
  mine = recordResult(mine, { gameId: mine.lineup[0], status: 'won', now: t + 60_000 });
  assert.equal(paceVersusPar(mine, par), -40);
  assert.equal(paceVersusPar(newRun('2026-10-09', t), par), null);
  assert.match(shareText(mine, 'https://x.org', par), /Beat Skeeter by/);
});

test('test gauntlets: replayable 2099 days, the first three cover every game', () => {
  assert.equal(GAUNTLET_START, '2026-10-13');
  assert.equal(gauntletLaunched('2026-10-12'), false);
  assert.equal(gauntletLaunched('2026-10-13'), true);
  assert.equal(testDay(1), '2099-01-01');
  assert.ok(isTestDay(testDay(TEST_GAUNTLETS)) && !isTestDay('2026-10-09'));
  const covered = new Set();
  for (let n = 1; n <= TEST_GAUNTLETS; n++) {
    const lineup = gauntletLineup(testDay(n));
    assert.equal(new Set(lineup.map(game => game.id)).size, 6);
    lineup.forEach(game => { assert.ok(GAUNTLET_GAMES.some(g => g.id === game.id)); if (n <= 3) covered.add(game.id); });
    assert.deepEqual(restoreRun(newRun(testDay(n), 1), testDay(n)).lineup, lineup.map(game => game.id));
  }
  assert.equal(covered.size, GAUNTLET_GAMES.length);
});

test('the give-up penalty counts down with time spent and never goes negative', () => {
  assert.equal(remainingPenalty(240, 0), 240);
  assert.equal(remainingPenalty(240, 61.9), 179);
  assert.equal(remainingPenalty(240, 240), 0);
  assert.equal(remainingPenalty(240, 900), 0);
  let run = newRun('2026-10-09', 0);
  run = recordResult(run, { gameId: run.lineup[0], status: 'lost', now: 500_000, penalty: 240 });
  assert.deepEqual([run.results[0].seconds, run.results[0].penalty, run.results[0].total], [500, 0, 500]);
});

test('a server-timed run becomes the page\'s run on the device clock', () => {
  const serverRun = { day: '2026-10-09', lineup: gauntletLineup('2026-10-09').map(game => game.id), index: 1, gameStartedAt: 5000, waiting: true,
    results: [{ game: 'x', status: 'won', seconds: 4, penalty: 0, total: 4 }], startedAt: 1000, finishedAt: null, uid: 'u' };
  serverRun.results[0].game = serverRun.lineup[0];
  const run = fromServerRun(serverRun, 400);
  assert.deepEqual([run.date, run.startedAt, run.gameStartedAt, run.finishedAt, run.ranked, run.waiting], ['2026-10-09', 600, 4600, null, true, true]);
  assert.equal(fromServerRun({ ...serverRun, lineup: [...serverRun.lineup].reverse() }), null);
  assert.equal(fromServerRun(null), null);
});

test('How to play pauses the clock, up to the pause allowance per run', async () => {
  const { pauseRun, resumeRun, PAUSE_ALLOWANCE } = await import('./gauntlet.js');
  let run = newRun('2026-10-09', 0);
  run = pauseRun(run, 30_000);
  assert.equal(currentGameSeconds(run, 90_000), 30, 'frozen while paused');
  run = resumeRun(run, 90_000);
  assert.equal(currentGameSeconds(run, 100_000), 40);
  assert.equal(run.pausedSeconds, 60);
  // A long pause only credits what is left of the allowance.
  run = pauseRun(run, 100_000);
  assert.equal(currentGameSeconds(run, 100_000 + (PAUSE_ALLOWANCE - 60) * 1000 + 15_000), 55, 'clock runs again once the allowance is used');
  run = recordResult(run, { gameId: run.lineup[0], status: 'won', now: 100_000 + 1_000_000 });
  assert.equal(run.results[0].seconds, 100 + 1000 - PAUSE_ALLOWANCE);
  assert.equal(run.pausedAt, null);
  assert.equal(pauseRun(run, 5), run, 'no pausing between games');
});

test('a lost or given-up word game keeps its answer; a won one does not', () => {
  const t = 1_000_000;
  let run = newRun('2026-10-09', t);
  const [first, second] = run.lineup;
  const won = recordResult(run, { gameId: first, status: 'won', now: t + 5000, answer: 'stone' });
  assert.equal('answer' in won.results[0], false);
  run = recordResult(run, { gameId: first, status: 'lost', now: t + 5000, answer: 'stone' });
  assert.equal(run.results[0].answer, 'stone');
  run = startNextGame(run, t + 6000);
  run = recordResult(run, { gameId: second, status: 'gave-up', now: t + 9000 });
  assert.equal('answer' in run.results[1], false, 'games without an answer add nothing');
});
