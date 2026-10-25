import { doSegmentsCross, getPossibleBridges } from './solver.js';

// Steps for the Hashkeet "Learn to play" walkthrough: the basic Hashi logic,
// one island at a time. Returns [{ reason, focus: [islandId], targets:
// [bridgeKey, ...], need, ... }] or null if these moves don't solve it. A
// target appears once per bridge to draw (twice for a double bridge).
//  full       the island needs every bridge it can still take
//  atLeast    even with all the others, one neighbour must get a bridge
//  isolation  joining two islands would cut them off from the rest, so
//             the bridge must go elsewhere
export const bridgeKey = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;

export function hashiWalkthrough(islands) {
  const edges = getPossibleBridges(islands).map(edge => ({ ...edge, key: bridgeKey(edge.from, edge.to) }));
  const byId = new Map(islands.map(island => [island.id, island]));
  const low = edges.map(() => 0);
  const high = edges.map(edge => Math.min(2, byId.get(edge.from).req, byId.get(edge.to).req));
  const incident = id => edges.flatMap((edge, i) => edge.from === id || edge.to === id ? [i] : []);
  const other = (i, id) => edges[i].from === id ? edges[i].to : edges[i].from;
  const placed = id => incident(id).reduce((sum, i) => sum + low[i], 0);
  const need = id => byId.get(id).req - placed(id);
  // A bridge can't cross one that's already drawn.
  const blocked = i => edges.some((edge, j) => low[j] > 0 && doSegmentsCross(byId.get(edges[i].from), byId.get(edges[i].to), byId.get(edge.from), byId.get(edge.to)));
  // How many more bridges this edge could take, seen from island `id`.
  const room = (i, id) => blocked(i) ? 0 : Math.max(0, Math.min(high[i] - low[i], need(other(i, id))));
  const steps = [];

  // The first move the basic rules allow, as { island, adds: [edge index...] }.
  function basicMove() {
    for (const island of islands) {
      const id = island.id, left = need(id);
      if (left <= 0) continue;
      const rooms = incident(id).map(i => [i, room(i, id)]).filter(([, r]) => r > 0);
      const total = rooms.reduce((sum, [, r]) => sum + r, 0);
      if (total < left) return { impossible: true };
      if (total === left) return { island: id, reason: 'full', adds: rooms.flatMap(([i, r]) => Array(r).fill(i)) };
      for (const [i, r] of rooms) {
        const atLeast = left - (total - r);
        if (atLeast > 0) return { island: id, reason: 'atLeast', adds: Array(atLeast).fill(i) };
      }
    }
    return null;
  }

  // Islands joined to `id` by drawn bridges, plus `extra` edge.
  function group(id, extra) {
    const seen = new Set([id]), stack = [id];
    while (stack.length) {
      const at = stack.pop();
      for (const i of incident(at)) {
        if (low[i] === 0 && i !== extra) continue;
        const next = other(i, at);
        if (!seen.has(next)) { seen.add(next); stack.push(next); }
      }
    }
    return seen;
  }

  for (let guard = 0; guard < 200; guard++) {
    if (islands.every(island => need(island.id) === 0)) break;
    let move = basicMove();
    if (move?.impossible) return null;
    if (!move) {
      // Isolation: finishing island a and b with a bridge between them
      // would close off a group that isn't every island.
      for (let i = 0; i < edges.length && !move; i++) {
        const { from, to } = edges[i];
        if (high[i] <= low[i] || blocked(i)) continue;
        const extra = Math.min(need(from), need(to));
        if (need(from) !== need(to) || extra > high[i] - low[i]) continue;
        const closed = [...group(from, i)].every(id => id === from || id === to || need(id) === 0);
        if (!closed || group(from, i).size === islands.length) continue;
        high[i] = low[i] + extra - 1;
        const next = basicMove();
        if (next && !next.impossible && (next.island === from || next.island === to)) move = { ...next, reason: 'isolation', partner: next.island === from ? to : from };
      }
    }
    if (!move) return null;
    const left = need(move.island);
    move.adds.forEach(i => { low[i]++; });
    steps.push({ reason: move.reason, focus: [move.island], need: left, partner: move.partner,
      targets: move.adds.map(i => edges[i].key), ordered: true });
  }
  return islands.every(island => need(island.id) === 0) ? steps : null;
}

// The walkthrough board: a 5 x 5 grid of six islands.
export const TUTORIAL_ISLANDS = [[0, 1, 4], [0, 4, 2], [2, 1, 4], [2, 4, 1], [4, 1, 2], [4, 4, 1]]
  .map(([r, c, req], id) => ({ id, r, c, req }));

// What each step says, in walkthrough order (the test checks the order).
export const TUTORIAL_WORDS = [
  { title: 'A 4 with only two neighbors',
    text: 'Two islands can share at most two bridges. This 4 can only reach two islands, and 2 + 2 = 4, so it needs a double bridge to both. Tap the glowing gap twice, then the next one twice.' },
  { title: 'Count what can still fit',
    text: 'This 4 has two bridges and needs two more. The 1 on its right can only take one bridge, so at least one has to go down to the 2. Tap that gap.' },
  { title: 'Don\'t cut anyone off',
    text: 'One bridge left. A second bridge down to the 2 would finish both islands and close off the four on the left from the two on the right. Everything must join up, so the last bridge goes to the 1.' },
  { title: 'Finish it',
    text: 'The 2 at the bottom needs one more bridge, and the 1 beside it is its only other neighbor. Tap the gap to join everything up.' },
];

