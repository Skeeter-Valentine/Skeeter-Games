import assert from 'node:assert/strict';
import test from 'node:test';
import { makeCandidate, solutions } from './puzzle.js';
import { mapWalkthrough } from './walkthrough.js';

test('the tutorial map is colored by forced moves alone', () => {
  const map = makeCandidate(104, 'Small');
  const [answer] = solutions(map.adj, map.clues, 2);
  assert.equal(solutions(map.adj, map.clues, 2).length, 1);
  const steps = mapWalkthrough(map);
  assert.ok(steps);
  const colors = [...map.clues];
  for (const step of steps) {
    const [region] = step.targets;
    assert.equal(colors[region], -1);
    assert.equal(new Set(map.adj[region].map(other => colors[other]).filter(c => c >= 0)).size, 3);
    colors[region] = step.color;
  }
  assert.deepEqual(colors, answer);
});
