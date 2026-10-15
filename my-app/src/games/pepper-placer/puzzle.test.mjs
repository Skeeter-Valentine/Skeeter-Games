import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS, countSolutions, dailyPuzzle, generatePuzzle, mulberry32, checkBoard, solvesLogically, walkthrough } from './puzzle.js';

function assertValid(puzzle) {
  const { size: n, peppers: k, regions, solution } = puzzle;
  assert.equal(regions.length, n);
  const ids = new Set(regions.flat());
  assert.equal(ids.size, n, 'one patch per row');
  const cells = solution.flatMap((cols, r) => cols.map(c => [r, c]));
  assert.equal(cells.length, n * k);
  for (let i = 0; i < n; i++) {
    assert.equal(cells.filter(([r]) => r === i).length, k);
    assert.equal(cells.filter(([, c]) => c === i).length, k);
  }
  for (const id of ids) assert.equal(cells.filter(([r, c]) => regions[r][c] === id).length, k);
  for (const [r, c] of cells) for (const [r2, c2] of cells) if (r !== r2 || c !== c2) assert.ok(Math.max(Math.abs(r - r2), Math.abs(c - c2)) > 1, 'peppers never touch');
  assert.equal(countSolutions(puzzle, 3), 1, 'exactly one solution');
  assert.ok(solvesLogically(puzzle, LEVELS[puzzle.size === 6 ? 1 : 2].techniques), 'solvable without guessing');
  assert.ok(checkBoard(puzzle, new Set(cells.map(([r, c]) => r * n + c))).won);
}

test('every level builds valid puzzles that solve without guessing', () => {
  for (const level of [1, 2, 3]) for (let seed = 1; seed <= 4; seed++) {
    const puzzle = generatePuzzle(level, mulberry32(seed * 97 + level));
    assert.equal(puzzle.size, LEVELS[level].size);
    assert.equal(puzzle.peppers, LEVELS[level].peppers);
    assertValid(puzzle);
  }
});

test('Mild puzzles need only the simplest step', () => {
  for (let seed = 1; seed <= 10; seed++) assert.ok(solvesLogically(generatePuzzle(1, mulberry32(seed)), 'basic'));
});

test('daily puzzles are the same for everyone', () => {
  assert.deepEqual(dailyPuzzle('2026-10-14', 3), dailyPuzzle('2026-10-14', 3));
  assert.notDeepEqual(dailyPuzzle('2026-10-14', 1).regions, dailyPuzzle('2026-10-15', 1).regions);
});

test('the board checker finds touching peppers and overfull lines', () => {
  const puzzle = generatePuzzle(1, mulberry32(5));
  const n = puzzle.size;
  const status = checkBoard(puzzle, new Set([0, 1, n + 1]));
  assert.ok(!status.won);
  assert.deepEqual([...status.conflicts].sort((a, b) => a - b), [0, 1, n + 1]);
  assert.ok(status.rows[0] === 'over' && status.cols[1] === 'over');
});

test('the walkthrough solves Mild boards one simple step at a time', () => {
  const board = { size: 5, peppers: 1, regions: ['11100', '11002', '41000', '41333', '43333'].map(row => [...row].map(Number)) };
  const steps = walkthrough(board);
  assert.equal(countSolutions(board, 3), 1);
  const peppers = steps.filter(step => step.kind === 'pepper').map(step => step.cell).sort((a, b) => a - b);
  assert.equal(peppers.length, 5);
  assert.ok(checkBoard(board, new Set(peppers)).won);
  assert.equal(steps[0].unit.type, 'patch');
  assert.equal(steps[0].unit.cells.length, 1, 'starts with a one-square patch');
  for (let seed = 1; seed <= 10; seed++) assert.ok(walkthrough(generatePuzzle(1, mulberry32(seed))), 'every Mild board has a walkthrough');
  assert.equal(walkthrough(generatePuzzle(3, mulberry32(1))), null, 'only 1-pepper boards');
});
