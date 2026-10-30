import assert from 'node:assert/strict';
import test from 'node:test';
import { cluesFor, dailyPuzzle, dailySize, evaluateBoard, generatePuzzle, geometry, hEdge, solve, vEdge } from './puzzle.js';

// A 2 x 2 board whose loop runs round the outside.
const outer = (() => {
  const lines = [hEdge(2, 0, 0), hEdge(2, 0, 1), hEdge(2, 2, 0), hEdge(2, 2, 1), vEdge(2, 2, 0, 0), vEdge(2, 2, 1, 0), vEdge(2, 2, 0, 2), vEdge(2, 2, 1, 2)];
  return lines;
})();

test('clues count each square\'s lines; a single loop meeting every clue wins', () => {
  assert.deepEqual(cluesFor(2, 2, outer), [2, 2, 2, 2]);
  const puzzle = { rows: 2, cols: 2, clues: [2, 2, 2, 2] };
  assert.equal(evaluateBoard(puzzle, outer).won, true);
  assert.equal(evaluateBoard(puzzle, outer.slice(1)).won, false, 'an open path is not a loop');
  const status = evaluateBoard({ rows: 2, cols: 2, clues: [1, -1, -1, -1] }, outer);
  assert.equal(status.clueState[0], 'over');
});

test('two separate loops do not win, and branching dots are reported', () => {
  const g = geometry(1, 3);
  // Squares 0 and 2 each ringed: two loops.
  const ring = c => [hEdge(3, 0, c), hEdge(3, 1, c), vEdge(1, 3, 0, c), vEdge(1, 3, 0, c + 1)];
  const lines = [...ring(0), ...ring(2)];
  assert.equal(evaluateBoard({ rows: 1, cols: 3, clues: [4, 0, 4] }, lines).won, false);
  const touching = [...ring(0), ...ring(1)];
  assert.ok(evaluateBoard({ rows: 1, cols: 3, clues: [-1, -1, -1] }, [...new Set(touching)]).branches.length > 0);
  assert.equal(g.E, 10);
});

test('generated puzzles have one solution, found by logic, at every level and size', () => {
  for (const [size, level] of [[5, 1], [6, 2], [7, 3], [8, 2], [10, 3]]) {
    const puzzle = generatePuzzle(size, size, `test-${size}-${level}`, level);
    assert.equal(evaluateBoard(puzzle, puzzle.solution).won, true);
    const result = solve(puzzle);
    assert.equal(result.solved, true, `${size} level ${level}`);
    if (level < 3) assert.equal(result.trials, 0, 'Mild and Medium need no trials');
    assert.ok(puzzle.clues.some(c => c < 0), 'some squares are blank');
  }
});

test('the daily is the same for everyone and sized by its peppers', () => {
  const date = '2026-11-02';
  const a = dailyPuzzle(date), b = dailyPuzzle(date);
  assert.deepEqual(a.clues, b.clues);
  assert.equal(a.rows, dailySize(date));
  assert.ok([6, 8, 10].includes(a.rows));
});

test('the walkthrough steps solve its board, each one by logic', async () => {
  const { TUTORIAL_PUZZLE, TUTORIAL_SOLUTION, TUTORIAL_STEPS } = await import('./walkthrough.js');
  const drawn = TUTORIAL_STEPS.filter(step => step.action === 'line').flatMap(step => step.targets);
  assert.deepEqual([...drawn].sort((a, b) => a - b), TUTORIAL_SOLUTION);
  assert.equal(evaluateBoard(TUTORIAL_PUZZLE, TUTORIAL_SOLUTION).won, true);
  const crossed = TUTORIAL_STEPS.flatMap(step => step.action === 'cross' ? [...step.targets, ...step.auto] : step.auto);
  assert.ok(crossed.every(edge => !TUTORIAL_SOLUTION.includes(edge)), 'crossed sides are not in the loop');
  assert.equal(solve(TUTORIAL_PUZZLE).solved, true);
});
