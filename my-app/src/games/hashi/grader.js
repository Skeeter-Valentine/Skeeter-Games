import { doSegmentsCross, getPossibleBridges, isConnected } from './solver.js';

// Solves a Hashi puzzle the way a person would, to judge how hard it is.
//
// Basic steps (what most players do):
//   - Counting: an island's number, against the most and fewest bridges its
//     neighbours can still take, forces or rules out bridges.
//   - A bridge that's in place blocks every bridge crossing it.
//   - The islands must still be able to join up into one network.
// Advanced step (what makes a puzzle hard): try a bridge count and follow the
// basic steps until something breaks (an island can't reach its number, or a
// group gets cut off), which rules that count out.
//
// Returns { solved, advanced }: whether these steps solve the puzzle without
// guessing, and how many advanced steps it took.
export function gradePuzzle(islands) {
  const edges = getPossibleBridges(islands);
  const byId = new Map(islands.map(island => [island.id, island]));
  const index = new Map(islands.map((island, i) => [island.id, i]));
  const incident = islands.map(() => []);
  edges.forEach((edge, i) => { incident[index.get(edge.from)].push(i); incident[index.get(edge.to)].push(i); });
  const crossings = edges.map(edge => edges.flatMap((other, j) =>
    doSegmentsCross(byId.get(edge.from), byId.get(edge.to), byId.get(other.from), byId.get(other.to)) ? [j] : []));

  // Narrows the possible counts ([low, high] per bridge) with the basic
  // steps. Returns false when the puzzle can't be finished from here.
  function basic(low, high) {
    for (let changed = true; changed;) {
      changed = false;
      for (let n = 0; n < islands.length; n++) {
        const req = islands[n].req;
        let min = 0, max = 0;
        for (const i of incident[n]) { min += low[i]; max += high[i]; }
        if (req < min || req > max) return false;
        for (const i of incident[n]) {
          // Room left for this bridge once the others take their least / most.
          const most = Math.min(high[i], req - (min - low[i]));
          const least = Math.max(low[i], req - (max - high[i]));
          if (most < least) return false;
          if (most !== high[i] || least !== low[i]) { high[i] = most; low[i] = least; changed = true; }
        }
      }
      for (let i = 0; i < edges.length; i++) {
        if (low[i] === 0) continue;
        for (const j of crossings[i]) {
          if (low[j] > 0) return false;
          if (high[j] > 0) { high[j] = 0; changed = true; }
        }
      }
      if (!isConnected(islands, edges.map((edge, i) => ({ ...edge, count: high[i] })))) return false;
    }
    return true;
  }

  const low = edges.map(() => 0), high = edges.map(() => 2);
  if (!basic(low, high)) return { solved: false, advanced: 0 };
  let advanced = 0;
  const done = () => low.every((value, i) => value === high[i]);
  while (!done()) {
    // One advanced step: the first bridge count that leads to a dead end.
    let found = false;
    for (let i = 0; i < edges.length && !found; i++) {
      for (let value = low[i]; value <= high[i] && !found; value++) {
        if (low[i] === high[i]) break;
        const tryLow = low.slice(), tryHigh = high.slice();
        tryLow[i] = tryHigh[i] = value;
        if (basic(tryLow, tryHigh)) continue;
        // Rule out `value`: it's at one end of the range, or (a middle value)
        // record nothing and look for another step.
        if (value === low[i]) low[i] = value + 1;
        else if (value === high[i]) high[i] = value - 1;
        else continue;
        found = true;
      }
    }
    if (!found || !basic(low, high)) return { solved: false, advanced };
    advanced++;
  }
  // Connected and every number met: the board is a finished solution.
  const solution = edges.map((edge, i) => ({ ...edge, count: low[i] }));
  return { solved: isConnected(islands, solution), advanced };
}
