import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateBoard, solvePuzzle } from './puzzle.js';
import { akariWalkthrough } from './walkthrough.js';

// Same board as AkariTutorial.jsx.
const LAYOUT = ['##.3.', '0....', '.#...', '.###.', '1..##'];
const BOARD = { size: 5, cells: LAYOUT.join('').split('').map(ch => ch === '.' ? null : ch === '#' ? -1 : Number(ch)) };

test('the tutorial board has one solution', () => {
  assert.equal(solvePuzzle(BOARD, { limit: 2 }).solutions.length, 1);
});

test('the walkthrough solves the tutorial board with the basic moves', () => {
  const steps = akariWalkthrough(BOARD);
  assert.ok(steps);
  const bulbs = steps.filter(step => step.action === 'bulb').flatMap(step => step.targets);
  assert.ok(evaluateBoard(BOARD, bulbs).won);
  assert.deepEqual(new Set(steps.map(step => step.reason)), new Set(['zero', 'wallFull', 'lighting', 'onlyLight', 'wallDone']));
  for (const step of steps) assert.equal(step.action === 'info', step.targets.length === 0);
});
