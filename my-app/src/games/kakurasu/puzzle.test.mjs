import assert from 'node:assert/strict';
import test from 'node:test';
import { PRACTICE_SIZES, cluesFor, countSolutions, dailyPuzzle, dailySize, evaluateBoard, generatePuzzle, lineOptions, solveByLines } from './puzzle.js';
import { scheduledDifficulty } from '../../utils/dailySchedule.js';

test('clues add up row and column positions', () => {
  // Row 1 shades columns 1 and 3; row 2 shades column 3.
  const { rows, cols } = cluesFor(3, [0, 2, 5]);
  assert.deepEqual(rows, [4, 3, 0]);
  assert.deepEqual(cols, [1, 0, 3]);
  assert.deepEqual(lineOptions(4, 4).sort(), [0b1000, 0b0101].sort());
});

test('evaluateBoard marks met and over lines and wins only on a full match', () => {
  const puzzle = { size: 3, rows: [4, 3, 1], cols: [4, 0, 3] };
  assert.equal(evaluateBoard(puzzle, [0, 2, 5, 6]).won, true);
  const partial = evaluateBoard(puzzle, [0, 1, 2]);
  assert.deepEqual(partial.rows, ['over', '', '']);
  assert.equal(partial.won, false);
});

test('generated puzzles have one solution and are solved by line logic alone', () => {
  for (const size of PRACTICE_SIZES) {
    for (let seed = 0; seed < 15; seed++) {
      const puzzle = generatePuzzle(size, `test:${size}:${seed}`);
      assert.equal(puzzle.size, size);
      assert.ok([...puzzle.rows, ...puzzle.cols].every(clue => clue > 0));
      assert.ok(solveByLines(puzzle).solved, `size ${size}, seed ${seed}`);
      assert.equal(countSolutions(puzzle), 1, `size ${size}, seed ${seed}`);
      // The line solver's answer really matches the clues.
      const { grid } = solveByLines(puzzle);
      assert.ok(evaluateBoard(puzzle, grid.flatMap((value, id) => value === 1 ? [id] : [])).won);
    }
  }
});

test('countSolutions finds ambiguous boards', () => {
  assert.equal(countSolutions({ size: 2, rows: [1, 2], cols: [1, 2] }), 1);
  // Every row and column adds to 3: there's more than one way.
  assert.equal(countSolutions({ size: 3, rows: [3, 3, 3], cols: [3, 3, 3] }), 2);
});

test('daily puzzles repeat and follow the pepper schedule', () => {
  for (const date of ['2026-10-26', '2026-10-27', '2026-10-28', '2026-11-01']) {
    assert.deepEqual(dailyPuzzle(date), dailyPuzzle(date));
    assert.equal(dailyPuzzle(date).size, dailySize(date));
    assert.equal(dailySize(date), [5, 6, 8][scheduledDifficulty('kakurasu', date) - 1]);
  }
});
