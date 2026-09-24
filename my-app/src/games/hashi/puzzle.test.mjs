import assert from 'node:assert/strict';
import test from 'node:test';
import { generateUniquePuzzle, mulberry32 } from './puzzle.js';
import { countSolutions, getPossibleBridges, isConnected } from './solver.js';

const square = (requirements) => [[0, 0], [0, 2], [2, 2], [2, 0]]
    .map(([r, c], id) => ({ id, r, c, req: requirements[id] }));

test('distinguishes unique, ambiguous, and impossible puzzles', () => {
    assert.equal(countSolutions(square([2, 2, 2, 2])), 1);
    assert.equal(countSolutions(square([3, 3, 3, 3])), 2);
    assert.equal(countSolutions(square([1, 1, 1, 1])), 0);
    assert.equal(countSolutions(square([8, 1, 1, 1])), 0);
    assert.equal(countSolutions([]), 0);
    assert.equal(countSolutions(square([2, 2, 2, 2]), 0), null);
});

test('matches independent exhaustive enumeration for every square clue assignment', () => {
    // Four perimeter edges; independently enumerate all 3^4 bridge assignments.
    const counts = new Map();
    for (let code = 0; code < 81; code++) {
        const edges = Array.from({ length: 4 }, (_, i) => Math.floor(code / 3 ** i) % 3);
        // A four-cycle remains connected exactly when at most one edge is absent.
        if (edges.filter(value => value === 0).length > 1) continue;
        const req = edges.map((value, i) => value + edges[(i + 3) % 4]);
        const key = req.join(',');
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (let code = 0; code < 256; code++) {
        const req = Array.from({ length: 4 }, (_, i) => 1 + Math.floor(code / 4 ** i) % 4);
        assert.equal(countSolutions(square(req)), Math.min(2, counts.get(req.join(',')) || 0), req.join(','));
    }
});

test('cannot bridge over an intervening island', () => {
    const islands = [0, 2, 4].map((c, id) => ({ id, r: 0, c, req: id === 1 ? 2 : 1 }));
    assert.deepEqual(getPossibleBridges(islands), [{ from: 0, to: 1 }, { from: 1, to: 2 }]);
    assert.equal(countSolutions(islands), 1);
});

test('rejects forced crossing bridges even when counts and connectivity would match', () => {
    const islands = [[0, 2, 2], [2, 0, 2], [2, 4, 1], [4, 2, 1], [0, 0, 2]]
        .map(([r, c, req], id) => ({ id, r, c, req }));
    assert.equal(countSolutions(islands), 0);
});

test('connectivity rejects separate completed groups and ignores absent bridges', () => {
    const islands = square([2, 2, 2, 2]);
    const bridges = [{ from: 0, to: 1, count: 2 }, { from: 2, to: 3, count: 2 }];
    assert.equal(isConnected(islands, bridges), false);
    assert.equal(isConnected(islands, [...bridges, { from: 1, to: 2, count: 0 }]), false);
    assert.equal(isConnected(islands, [...bridges, { from: 1, to: 2, count: 1 }]), true);
});

test('generates unique puzzles across all supported sizes and 100 seeds each', () => {
    for (const size of [5, 6, 7, 8]) {
        for (let seed = 0; seed < 100; seed++) {
            const islands = generateUniquePuzzle(size, mulberry32(seed));
            assert.ok(islands.length >= 3);
            assert.ok(islands.every(i => i.r >= 0 && i.r < size && i.c >= 0 && i.c < size));
            assert.equal(countSolutions(islands), 1, `size=${size}, seed=${seed}`);
        }
    }
});

test('daily generation repeats including the seeded size selection', () => {
    const daily = () => {
        const rng = mulberry32(20260924);
        const size = [5, 6, 7, 8][Math.floor(rng() * 4)];
        return generateUniquePuzzle(size, rng);
    };
    assert.deepEqual(daily(), daily());
});

test('pathological RNG terminates with a unique fallback', () => {
    let calls = 0;
    // A 2x2 grid cannot fit the candidate generator's two-cell spacing,
    // forcing all 100 attempts to fail before the fallback is used.
    const islands = generateUniquePuzzle(2, () => { calls++; return 0; });
    assert.equal(countSolutions(islands), 1);
    assert.equal(islands.length, 3);
    assert.equal(calls, 302);
});
