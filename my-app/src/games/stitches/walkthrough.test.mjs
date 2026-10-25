import assert from 'node:assert/strict';
import test from 'node:test';
import { checkSolution, getCounts, getEdges, solvePuzzle } from './puzzle.js';
import { TUTORIAL_PUZZLE, TUTORIAL_STEPS } from './walkthrough.js';

test('the tutorial board has one solution, and the steps place it', () => {
  const result = solvePuzzle(TUTORIAL_PUZZLE);
  assert.ok(result.complete);
  assert.equal(result.solutions.length, 1);
  const stitches = TUTORIAL_STEPS.flatMap(step => step.targets);
  assert.ok(checkSolution(TUTORIAL_PUZZLE, stitches));
  assert.deepEqual([...stitches].sort(), [...result.solutions[0]].sort());
});

test('the clues match the stitches and every target is a real border', () => {
  const edges = getEdges(TUTORIAL_PUZZLE.regions);
  const stitches = TUTORIAL_STEPS.flatMap(step => step.targets).map(id => edges.find(edge => edge.id === id));
  assert.ok(stitches.every(Boolean));
  const counts = getCounts(5, stitches);
  assert.deepEqual(counts.rows, TUTORIAL_PUZZLE.rows);
  assert.deepEqual(counts.cols, TUTORIAL_PUZZLE.cols);
});
