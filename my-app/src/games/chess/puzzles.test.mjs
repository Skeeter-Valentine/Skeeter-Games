import assert from 'node:assert/strict';
import test from 'node:test';
import { findUci, gameEnd, parseFen } from './engine.js';
import { mateMoves } from './solver.js';
import { readFileSync, readdirSync } from 'node:fs';
import { ALL_PUZZLES, CLEAR_FROM, clearFinish, legacyDailyPuzzle, puzzleFinish, puzzlesFor } from './bankTools.js';
import BANK_INFO from './bankInfo.js';
import { dailyLevel, dailyPuzzle, judgeMove, levelOf, playerColor, practicePuzzle, provideChessPuzzles, puzzlePositions, puzzleProblems } from './puzzles.js';

// The site's files (public/chess, written by scripts/build-chess-puzzles.mjs).
const PUBLIC = new URL('../../../public/chess/', import.meta.url);
const daily = Object.assign({}, ...readdirSync(new URL('daily/', PUBLIC)).map(name => JSON.parse(readFileSync(new URL(`daily/${name}`, PUBLIC), 'utf8'))));
const practice = Object.fromEntries([1, 2, 3].map(level => [level, JSON.parse(readFileSync(new URL(`practice/${level}-0.json`, PUBLIC), 'utf8'))]));
provideChessPuzzles({ daily, practice });

test('every puzzle in the bank plays through cleanly', () => {
  assert.ok(ALL_PUZZLES.length > 0);
  for (const puzzle of ALL_PUZZLES) assert.deepEqual(puzzleProblems(puzzle), [], puzzle.id);
  assert.equal(new Set(ALL_PUZZLES.map(p => p.id)).size, ALL_PUZZLES.length, 'ids are unique');
});

// Only the last move may have alternatives (any mate counts there), so a
// mate in 2 must have a single first move.
test('mates in two in the bank have exactly one first move', () => {
  for (const puzzle of ALL_PUZZLES) {
    if (!puzzle.themes.includes('mateIn2')) continue;
    const start = puzzlePositions(puzzle)[1];
    assert.equal(mateMoves(start, 2).length, 1, puzzle.id);
  }
});

test('ratings map to peppers, and every level has puzzles', () => {
  assert.equal(levelOf(800), 1); assert.equal(levelOf(1400), 2); assert.equal(levelOf(2200), 3);
  for (const level of [1, 2, 3]) assert.ok(puzzlesFor(level).length > 0);
});

test('the daily files cover every date, at its peppers, without repeats', () => {
  const dates = Object.keys(daily).sort();
  assert.equal(dates[0], BANK_INFO.dailyFrom);
  assert.equal(dates.at(-1), BANK_INFO.dailyThrough);
  assert.ok(dates.at(-1) >= '2028-01-01', 'at least a year ahead');
  const seen = new Map([[1, new Set()], [2, new Set()], [3, new Set()]]);
  for (const date of dates) {
    const puzzle = dailyPuzzle(date);
    assert.equal(levelOf(puzzle.rating), dailyLevel(date), date);
    const ids = seen.get(dailyLevel(date));
    // Within one pass through a level's clear puzzles, none repeats.
    if (ids.size < puzzlesFor(dailyLevel(date)).filter(clearFinish).length) assert.ok(!ids.has(puzzle.id), `${date} repeats ${puzzle.id}`);
    ids.add(puzzle.id);
  }
  assert.ok(practicePuzzle(1).id);
  assert.notEqual(practicePuzzle(1, practice[1][0][0], () => 0).id, practice[1][0][0], 'skips the puzzle just played');
});

test('dailies given out before the move to public/chess keep their puzzle', () => {
  for (let date = '2026-11-17'; date <= '2026-11-22'; date = new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)) {
    assert.equal(dailyPuzzle(date).id, legacyDailyPuzzle(date).id, date);
  }
  assert.equal(dailyPuzzle('2026-11-21').id, 'QjbYw');
});

test('the right move, or any mate on the last move, is accepted', () => {
  const puzzle = { id: 'y', fen: '6k1/5ppp/8/8/8/8/q4PPP/4R1K1 b - - 0 1', moves: ['a2b2', 'e1e8'], rating: 800, themes: [] };
  const pos = puzzlePositions(puzzle)[1];
  assert.equal(playerColor(puzzle), 'w');
  assert.equal(judgeMove(puzzle, 1, pos, findUci(pos, 'e1e8')), true);
  assert.equal(judgeMove(puzzle, 1, pos, findUci(pos, 'e1e2')), false);
  // A position with two mates in one: either counts on the final move.
  const twoMates = { id: 'x', fen: '7k/2p3pp/8/8/8/8/6PP/RR4K1 b - - 0 1', moves: ['c7c6', 'a1a8'], rating: 800, themes: [] };
  const start = puzzlePositions(twoMates)[1];
  assert.equal(judgeMove(twoMates, 1, start, findUci(start, 'b1b8')), true);
  assert.equal(judgeMove(twoMates, 1, start, findUci(start, 'b1b7')), false);
  assert.equal(gameEnd(parseFen('7k/6pp/8/8/8/8/6PP/RR4K1 b - - 0 1')), null);
});

test('from CLEAR_FROM, every daily and practice puzzle ends in mate or wins clear material', () => {
  for (const date of Object.keys(daily).filter(date => date >= CLEAR_FROM)) assert.ok(clearFinish(dailyPuzzle(date)), date);
  for (const rows of Object.values(practice)) for (const row of rows) assert.ok(clearFinish({ id: row[0], ...dailyPuzzleFromRow(row) }), row[0]);
});
const dailyPuzzleFromRow = ([, fen, moves, rating, themes]) => ({ fen, moves: moves.split(' '), rating, themes: themes.split(' ') });

test('the finish check sees mates, won material and quiet edges', () => {
  // Mate.
  assert.equal(puzzleFinish({ id: 'm', fen: '6k1/5ppp/8/8/8/8/q4PPP/4R1K1 b - - 0 1', moves: ['a2b2', 'e1e8'], rating: 800, themes: [] }).mate, true);
  // A quiet move wins nothing.
  const quiet = { id: 'q', fen: '4k3/8/8/8/8/8/4P3/4K3 b - - 0 1', moves: ['e8d8', 'e2e4'], rating: 800, themes: [] };
  assert.equal(puzzleFinish(quiet).gain, 0);
  assert.equal(clearFinish(quiet), false);
  // Taking a queen the opponent can't win back.
  const taken = { id: 't', fen: '4k3/8/8/8/1q6/3N4/8/4K3 b - - 0 1', moves: ['e8d8', 'd3b4'], rating: 800, themes: [] };
  assert.equal(puzzleFinish(taken).gain, 9);
  // The same capture where the knight is taken back still leaves 6.
  const traded = { id: 'r', fen: '1r2k3/8/8/8/1q6/3N4/8/4K3 b - - 0 1', moves: ['e8d8', 'd3b4'], rating: 800, themes: [] };
  assert.equal(puzzleFinish(traded).gain, 6);
  assert.equal(clearFinish(taken), true);
});
