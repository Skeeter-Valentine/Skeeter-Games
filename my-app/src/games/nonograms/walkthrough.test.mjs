import assert from 'node:assert/strict';
import test from 'node:test';
import { generateClues, isLogicallySolvable } from './puzzle.js';
import { TUTORIAL_PICTURE, TUTORIAL_SIZE, TUTORIAL_STEPS, clues } from './walkthrough.js';

const grid = TUTORIAL_PICTURE.map(row => row.map(Number));

test('the tutorial picture uses the game\'s clues and solves by logic alone', () => {
  const game = generateClues(grid);
  assert.deepEqual(clues(TUTORIAL_PICTURE), game.rowClues);
  assert.deepEqual(clues(TUTORIAL_PICTURE[0].map((_, c) => TUTORIAL_PICTURE.map(row => row[c]))), game.colClues);
  assert.ok(isLogicallySolvable(game));
});

test('the steps fill exactly the picture and only cross empty squares', () => {
  const filled = TUTORIAL_STEPS.filter(step => step.action === 'fill').flatMap(step => step.targets);
  const crossed = TUTORIAL_STEPS.filter(step => step.action === 'cross').flatMap(step => step.targets);
  const picture = grid.flat().flatMap((value, id) => value ? [id] : []);
  assert.deepEqual([...filled].sort((a, b) => a - b), picture);
  assert.ok(crossed.every(id => !grid.flat()[id]));
  assert.equal(new Set([...filled, ...crossed]).size, filled.length + crossed.length);
  assert.ok([...filled, ...crossed].every(id => id >= 0 && id < TUTORIAL_SIZE ** 2));
});
