import assert from 'node:assert/strict';
import test from 'node:test';
import { applyEvent, boardEntry, boardScore, cleanNickname, dayAllowed, gauntletDay, GauntletError, lineupIds, MIN_WIN_SECONDS } from './gauntlet.js';

const DAY = '2026-10-09';
const NOON = Date.parse('2026-10-09T18:00:00Z');
const rejects = (fn, code) => assert.throws(fn, error => error instanceof GauntletError && error.code === code);

test('only today, yesterday (a run crossing 4am) and test days are open', () => {
  assert.equal(gauntletDay(Date.parse('2026-10-09T09:59:00Z')), '2026-10-08');
  assert.equal(gauntletDay(Date.parse('2026-10-09T10:00:00Z')), '2026-10-09');
  assert.ok(dayAllowed(DAY, NOON));
  assert.ok(dayAllowed('2026-10-08', NOON));
  assert.ok(!dayAllowed('2026-10-07', NOON));
  assert.ok(!dayAllowed('2026-10-10', NOON));
  assert.ok(dayAllowed('2099-01-05', NOON));
  assert.ok(!dayAllowed('2026-02-30', NOON) && !dayAllowed('../x', NOON));
});

test('the server times every game and adds the shrinking penalty', () => {
  let { run } = applyEvent(null, { action: 'start', day: DAY }, NOON);
  assert.deepEqual(run.lineup, lineupIds(DAY));
  const again = applyEvent(run, { action: 'start', day: DAY }, NOON + 999);
  assert.ok(again.alreadyStarted);
  assert.equal(again.run, run);
  rejects(() => applyEvent(run, { action: 'finish', day: DAY, game: run.lineup[1], status: 'won' }, NOON + 60_000), 'failed-precondition');
  rejects(() => applyEvent(run, { action: 'finish', day: DAY, game: run.lineup[0], status: 'won' }, NOON + (MIN_WIN_SECONDS - 1) * 1000), 'failed-precondition');
  ({ run } = applyEvent(run, { action: 'finish', day: DAY, game: run.lineup[0], status: 'won' }, NOON + 90_000));
  assert.deepEqual(run.results[0], { game: run.lineup[0], status: 'won', seconds: 90, penalty: 0, bonus: 0, total: 90 });
  assert.equal(run.waiting, true);
  rejects(() => applyEvent(run, { action: 'finish', day: DAY, game: run.lineup[1], status: 'won' }, NOON + 200_000), 'failed-precondition');
  // The break between games is free: the clock restarts on "next".
  ({ run } = applyEvent(run, { action: 'next', day: DAY }, NOON + 500_000));
  // A claimed 3-minute penalty after 1 minute: 2 minutes are added.
  ({ run } = applyEvent(run, { action: 'finish', day: DAY, game: run.lineup[1], status: 'gave-up', penalty: 185 }, NOON + 560_000));
  assert.deepEqual(run.results[1], { game: run.lineup[1], status: 'gave-up', seconds: 60, penalty: 120, bonus: 0, total: 180 });
  // Penalties are clamped to 1-60 minutes, whatever the client says.
  ({ run } = applyEvent(run, { action: 'next', day: DAY }, NOON + 600_000));
  ({ run } = applyEvent(run, { action: 'finish', day: DAY, game: run.lineup[2], status: 'lost', penalty: 999_999 }, NOON + 610_000));
  assert.equal(run.results[2].penalty, 3590);
  let entry;
  for (const game of run.lineup.slice(3)) {
    ({ run } = applyEvent(run, { action: 'next', day: DAY }, NOON + 700_000));
    ({ run, entry } = applyEvent(run, { action: 'finish', day: DAY, game, status: 'won' }, NOON + 730_000));
  }
  assert.ok(run.finishedAt);
  assert.deepEqual(entry, { solved: 4, total: 90 + 180 + 3600 + 90, score: boardScore(4, 3960), finishedAt: NOON + 730_000 });
  rejects(() => applyEvent(run, { action: 'next', day: DAY }, NOON), 'failed-precondition');
  rejects(() => applyEvent(run, { action: 'reset', day: DAY }, NOON), 'failed-precondition');
  assert.deepEqual(applyEvent(run, { action: 'reset', day: '2099-01-01' }, NOON), { run: null, reset: true });
  rejects(() => applyEvent(null, { action: 'finish', day: DAY, game: 'akari', status: 'won' }, NOON), 'failed-precondition');
  rejects(() => applyEvent(null, { action: 'start', day: '2026-10-01' }, NOON), 'invalid-argument');
  // Yesterday's run can still be finished, but a new one can't be started.
  rejects(() => applyEvent(null, { action: 'start', day: '2026-10-08' }, NOON), 'failed-precondition');
});

test('the board ranks games solved first, then the fastest total', () => {
  const ranked = [[6, 3000], [6, 900], [5, 100], [6, 901], [0, 50], [5, 99]]
    .map(([solved, total]) => ({ solved, total, score: boardScore(solved, total) }))
    .sort((a, b) => a.score - b.score)
    .map(({ solved, total }) => `${solved}/${total}`);
  assert.deepEqual(ranked, ['6/900', '6/901', '6/3000', '5/99', '5/100', '0/50']);
  const run = { finishedAt: 1, results: [{ status: 'won', total: 10 }, { status: 'lost', total: 20 }] };
  assert.deepEqual(boardEntry(run), { solved: 1, total: 30, score: boardScore(1, 30), finishedAt: 1 });
});

test('nicknames are tidy, unique ignoring case, and clean', () => {
  assert.deepEqual(cleanNickname('  Puzzle   Fan_9 '), { nickname: 'Puzzle Fan_9', key: 'puzzlefan9' });
  assert.equal(cleanNickname('PUZZLE-fan 9').key, 'puzzlefan9');
  assert.equal(cleanNickname('Skeeter', { owner: true }).nickname, 'Skeeter');
  rejects(() => cleanNickname('fuckface', { owner: true }), 'invalid-argument');
  for (const bad of ['ab', 'x'.repeat(17), 'emoji🙂', 'a<b>c', 'Skeeter', 'sk33ter fan', 'the admin', 'Sh1thead']) rejects(() => cleanNickname(bad), 'invalid-argument');
});

test('the server lineup always matches the game page', async () => {
  const { gauntletLineup, testDay, TEST_GAUNTLETS } = await import('../src/gauntlet/gauntlet.js');
  const days = Array.from({ length: 730 }, (_, i) => new Date(Date.UTC(2026, 9, 9 + i)).toISOString().slice(0, 10));
  for (let n = 1; n <= TEST_GAUNTLETS; n++) days.push(testDay(n));
  for (const day of days) assert.deepEqual(lineupIds(day), gauntletLineup(day).map(game => game.id), day);
});

test('pausing for How to play is credited on the server too, up to the allowance', async () => {
  const { PAUSE_ALLOWANCE } = await import('./gauntlet.js');
  let { run } = applyEvent(null, { action: 'start', day: DAY }, NOON);
  ({ run } = applyEvent(run, { action: 'pause', day: DAY }, NOON + 20_000));
  ({ run } = applyEvent(run, { action: 'pause', day: DAY }, NOON + 25_000));
  ({ run } = applyEvent(run, { action: 'resume', day: DAY }, NOON + 80_000));
  ({ run } = applyEvent(run, { action: 'finish', day: DAY, game: run.lineup[0], status: 'won' }, NOON + 100_000));
  assert.equal(run.results[0].seconds, 40);
  // Finishing while paused (another tab) counts up to the pause.
  ({ run } = applyEvent(run, { action: 'next', day: DAY }, NOON + 200_000));
  ({ run } = applyEvent(run, { action: 'pause', day: DAY }, NOON + 230_000));
  ({ run } = applyEvent(run, { action: 'finish', day: DAY, game: run.lineup[1], status: 'won' }, NOON + 230_000 + PAUSE_ALLOWANCE * 1000 * 2));
  assert.equal(run.results[1].seconds, 30 + PAUSE_ALLOWANCE * 2 - (PAUSE_ALLOWANCE - 60));
});

test('a run from an older lineup rule is replaced on start', () => {
  const stale = { day: DAY, lineup: ['akari', 'map', 'pipes', 'hashi', 'shikaku', 'stitches'], index: 1, gameStartedAt: NOON, waiting: true, results: [{ game: 'akari' }], startedAt: NOON, finishedAt: null };
  const { run, alreadyStarted } = applyEvent(stale, { action: 'start', day: DAY }, NOON + 1000);
  assert.ok(!alreadyStarted);
  assert.deepEqual(run.lineup, lineupIds(DAY));
  assert.equal(run.results.length, 0);
  const finished = { ...stale, finishedAt: NOON };
  assert.ok(applyEvent(finished, { action: 'start', day: DAY }, NOON + 1000).alreadyStarted, 'finished runs stand');
});

test('word games take 5 seconds off for every guess left over', async () => {
  const { guessBonus } = await import('./gauntlet.js');
  assert.deepEqual([1, 2, 6].map(n => guessBonus('parshle', n)), [30, 25, 5]);
  assert.equal(guessBonus('quordle', 4), 30);
  assert.equal(guessBonus('word500', 8), 5);
  assert.equal(guessBonus('akari', 1), 0);
  assert.equal(guessBonus('parshle', 7), 0);
  assert.equal(guessBonus('parshle', '2'), 0);
  const day = DAY;
  let { run } = applyEvent(null, { action: 'start', day }, NOON);
  const first = run.lineup[0];
  ({ run } = applyEvent(run, { action: 'finish', day, game: first, status: 'won', guesses: 2 }, NOON + 100_000));
  assert.equal(run.results[0].bonus, guessBonus(first, 2));
  assert.equal(run.results[0].total, 100 - guessBonus(first, 2));
});

test('the page and the server agree on guess bonuses', async () => {
  const client = await import('../src/gauntlet/gauntlet.js');
  const { guessBonus } = await import('./gauntlet.js');
  for (const game of ['skeedlemath', 'quordle', 'parshle', 'word500', 'akari']) for (let n = 0; n <= 10; n++) assert.equal(client.guessBonus(game, n), guessBonus(game, n));
});
