import assert from 'node:assert/strict';
import test from 'node:test';
import { findUci, gameEnd, parseFen } from './engine.js';
import { mateMoves } from './solver.js';
import { ALL_PUZZLES, dailyLevel, dailyPuzzle, judgeMove, levelOf, playerColor, practicePuzzle, puzzlePositions, puzzleProblems, puzzlesFor } from './puzzles.js';

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

test('the daily is fixed per date, matches its peppers, and cycles without repeats', () => {
  assert.equal(dailyPuzzle('2026-11-10').id, dailyPuzzle('2026-11-10').id);
  const byLevel = new Map([[1, []], [2, []], [3, []]]);
  for (let day = 0; day < 90; day++) {
    const date = new Date(Date.UTC(2026, 10, 1 + day)).toISOString().slice(0, 10);
    byLevel.get(dailyLevel(date)).push(dailyPuzzle(date).id);
  }
  for (const [level, ids] of byLevel) {
    const pool = puzzlesFor(level).length;
    // Within one pass through a level's puzzles, none repeats.
    const firstPass = ids.slice(0, pool);
    assert.equal(new Set(firstPass).size, firstPass.length, `level ${level}`);
    // With a short list, every puzzle comes round.
    if (ids.length >= pool) assert.equal(new Set(ids).size, pool);
  }
  assert.ok(practicePuzzle(1).id);
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
