import assert from 'node:assert/strict';
import test from 'node:test';
import { TUTORIAL_GIVEN, TUTORIAL_SOLUTION, TUTORIAL_TAPS, TUTORIAL_WORDS, pipesWalkthrough, rotate } from './walkthrough.js';

const n = TUTORIAL_SOLUTION.length;
const at = id => TUTORIAL_SOLUTION[Math.floor(id / n)][id % n];

test('the tutorial board is one connected network with no loose ends or loops', () => {
  let joins = 0;
  for (let id = 0; id < n * n; id++) {
    const r = Math.floor(id / n), c = id % n, mask = at(id);
    if (mask & 1) { assert.ok(r > 0 && at(id - n) & 4); joins++; }
    if (mask & 2) { assert.ok(c < n - 1 && at(id + 1) & 8); joins++; }
    if (mask & 4) assert.ok(r < n - 1 && at(id + n) & 1);
    if (mask & 8) assert.ok(c > 0 && at(id - 1) & 2);
  }
  assert.equal(joins, n * n - 1, 'a tree: one fewer joins than tiles');
});

test('the walkthrough fixes every turned tile by logic, in the order its words describe', () => {
  const steps = pipesWalkthrough(TUTORIAL_SOLUTION, TUTORIAL_GIVEN);
  assert.deepEqual(steps.map(step => `${step.reason} ${step.cell}`), ['edge 0', 'edge 1', 'edge 8', 'neighbor 5', 'neighbor 13', 'neighbor 15']);
  assert.equal(steps.length, TUTORIAL_WORDS.length);
  assert.deepEqual(Object.keys(TUTORIAL_TAPS).map(Number).sort((a, b) => a - b), steps.map(step => step.cell).sort((a, b) => a - b));
  for (const step of steps) {
    // Turned back by its taps, the starting tile isn't already right.
    let start = at(step.cell);
    for (let i = 0; i < 4 - TUTORIAL_TAPS[step.cell]; i++) start = rotate(start);
    assert.notEqual(start, at(step.cell));
  }
});
