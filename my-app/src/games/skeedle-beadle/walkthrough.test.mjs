import assert from 'node:assert/strict';
import test from 'node:test';
import { isSolved, slide, slideProblem } from './puzzle.js';
import { TUTORIAL_MOVES, TUTORIAL_START } from './walkthrough.js';

test('the scripted walkthrough moves are legal and sort the board', () => {
  let sticks = TUTORIAL_START;
  const amounts = [];
  for (const { from, to } of TUTORIAL_MOVES) {
    assert.equal(slideProblem(sticks, from, to), null, `move ${from} -> ${to}`);
    const result = slide(sticks, from, to);
    amounts.push(result.amount);
    sticks = result.sticks;
  }
  assert.ok(isSolved(sticks));
  // The "move together" lesson really moves several beads at once.
  assert.equal(amounts[TUTORIAL_MOVES.findIndex(move => move.lesson === 'together')], 3);
});
