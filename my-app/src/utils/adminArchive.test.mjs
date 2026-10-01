import assert from 'node:assert/strict';
import test from 'node:test';
import { GAME_TITLES, buildRows, puzzleDates } from './adminArchive.js';
import { ARCHIVE_GAMES, ARCHIVE_START } from './archive.js';

test('every archive game has a title', () => {
  for (const game of ARCHIVE_GAMES) assert.ok(GAME_TITLES[game], game);
});

test('every date from the archive start through today gets a row', () => {
  const dates = puzzleDates('2026-08-25');
  assert.equal(dates[0], ARCHIVE_START);
  assert.equal(dates.at(-1), '2026-08-25');
  assert.equal(dates.length, 6);
});

test('daily and archive documents for a date are combined before ranking', () => {
  const rows = buildRows('sudoku', [
    { game: 'sudoku', date: '2026-08-21', mode: 'daily', starts: 5, wins: 5 },
    { game: 'sudoku', date: '2026-08-21', mode: 'archive', starts: 5, wins: 0 },
    { game: 'sudoku', date: '2026-08-22', mode: 'daily', starts: 10, wins: 10 },
  ], '2026-08-23');
  const row = rows.find(r => r.date === '2026-08-21');
  assert.equal(row.summary.starts, 10);
  assert.equal(row.summary.completion, 0.5);
  assert.equal(row.rank, 1);
});
