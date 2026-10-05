import assert from 'node:assert/strict';
import test from 'node:test';
import { CAPACITY, LEVELS, dailyLevel, dailyPuzzle, generatePuzzle, isSolved, slide, slideProblem, solve, tidyPath, topRun, usefulMoves } from './puzzle.js';

test('sliding moves the whole matching top run, limited by space', () => {
  const sticks = [[0, 1, 1], [2, 1], [], [3, 3, 3, 3]];
  assert.equal(topRun(sticks[0]), 2);
  assert.deepEqual(slide(sticks, 0, 1).sticks, [[0], [2, 1, 1, 1], [], [3, 3, 3, 3]]); // only 2 fit
  assert.deepEqual(slide(sticks, 1, 0).sticks[0], [0, 1, 1, 1]);
  assert.deepEqual(slide(sticks, 0, 2).sticks, [[0], [2, 1], [1, 1], [3, 3, 3, 3]]);
  assert.equal(slideProblem(sticks, 0, 3), 'full');
  assert.equal(slideProblem([[0], [1]], 0, 1), 'color');
  assert.equal(slideProblem(sticks, 2, 0), 'empty');
  assert.equal(slide(sticks, 0, 0), null);
});

test('a board is solved when every stick is empty or one full color', () => {
  assert.equal(isSolved([[1, 1, 1, 1], [], [0, 0, 0, 0]]), true);
  assert.equal(isSolved([[1, 1, 1], [1]]), false);
  assert.equal(isSolved([[0, 0, 0, 1]]), false);
});

test('useful moves skip finished sticks and duplicate empty targets', () => {
  const moves = usefulMoves([[0, 0, 0, 0], [1, 2], [], []]);
  assert.deepEqual(moves, [[1, 2]]);
});

test('daily puzzles are deterministic, fair and solvable at every level', () => {
  for (const date of ['2026-08-20', '2026-09-01', '2026-10-04', '2026-12-31']) {
    const puzzle = dailyPuzzle(date);
    assert.deepEqual(dailyPuzzle(date), puzzle);
    const config = LEVELS[dailyLevel(date)];
    assert.equal(puzzle.sticks.length, config.colors + config.empty);
    for (let color = 0; color < config.colors; color++) {
      assert.equal(puzzle.sticks.flat().filter(c => c === color).length, CAPACITY);
    }
    assert.ok(puzzle.par >= config.minMoves, `${date} par ${puzzle.par}`);
    let sticks = puzzle.sticks;
    for (const move of solve(sticks)) sticks = slide(sticks, ...move).sticks;
    assert.equal(isSolved(sticks), true);
  }
});

test('every level generates solvable puzzles', () => {
  for (const level of [1, 2, 3]) for (let i = 0; i < 5; i++) {
    const puzzle = generatePuzzle(level, `test-${level}-${i}`);
    const path = solve(puzzle.sticks);
    assert.ok(path, `level ${level} #${i}`);
    assert.ok(tidyPath(puzzle.sticks, path).length <= path.length);
  }
});

test('the solver reports dead ends instead of hanging', () => {
  // Two colors, no space to move anything useful.
  assert.equal(solve([[0, 1, 0, 1], [1, 0, 1, 0]]), null);
});
