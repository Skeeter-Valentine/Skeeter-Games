// Steps for the Skeeter Piper "Learn to play" walkthrough: the basic pipe
// logic, one tile at a time. A tile is a mask of its openings (1 north,
// 2 east, 4 south, 8 west); each tap turns it a quarter clockwise.
// pipesWalkthrough(solution) returns [{ reason, cell }] in an order a person
// can deduce, or null if these moves don't solve it:
//  edge      the board's edge leaves the tile only one way to face
//  neighbor  the tiles already fixed around it decide it
//  deadEnd   two dead ends can't face each other (they'd be cut off)
export const rotate = mask => ((mask << 1) | (mask >> 3)) & 15;
export const turns = mask => { const list = [mask]; for (let i = 1; i < 4; i++) list.push(rotate(list[i - 1])); return list; };
const bits = mask => (mask & 1) + (mask >> 1 & 1) + (mask >> 2 & 1) + (mask >> 3 & 1);
const DIRS = [[-1, 0, 1, 4], [0, 1, 2, 8], [1, 0, 4, 1], [0, -1, 8, 2]]; // dr, dc, bit, opposite bit

export function pipesWalkthrough(solution, given = []) {
  const n = solution.length;
  const cells = n * n;
  const mask = id => solution[Math.floor(id / n)][id % n];
  const fixed = new Map(given.map(id => [id, solution[Math.floor(id / n)][id % n]])); // cell -> orientation
  const fits = (id, orientation, rules) => DIRS.every(([dr, dc, bit, back]) => {
    const r = Math.floor(id / n) + dr, c = id % n + dc;
    const open = !!(orientation & bit);
    if (r < 0 || c < 0 || r >= n || c >= n) return !open;
    const other = r * n + c;
    if (rules >= 1 && fixed.has(other) && open !== !!(fixed.get(other) & back)) return false;
    if (rules >= 2 && open && bits(orientation) === 1 && bits(mask(other)) === 1 && cells > 2) return false;
    return true;
  });
  const options = (id, rules) => [...new Set(turns(mask(id)))].filter(o => fits(id, o, rules));
  const steps = [];
  for (let guard = 0; guard < cells && fixed.size < cells; guard++) {
    let move = null;
    for (const [rules, reason] of [[0, 'edge'], [1, 'neighbor'], [2, 'deadEnd']]) {
      for (let id = 0; id < cells && !move; id++) {
        if (fixed.has(id)) continue;
        const list = options(id, rules);
        if (!list.length) return null;
        if (list.length === 1) move = { cell: id, reason, orientation: list[0] };
      }
      if (move) break;
    }
    if (!move) return null;
    fixed.set(move.cell, move.orientation);
    steps.push(move);
  }
  return steps.every(step => step.orientation === mask(step.cell)) ? steps : null;
}

// Quarter turns clockwise from `from` until the tile looks like `to`.
export function tapsBetween(from, to) {
  let mask = from;
  for (let taps = 0; taps < 4; taps++) { if (mask === to) return taps; mask = rotate(mask); }
  return -1;
}

// The walkthrough board: a 4 x 4 network fed from the green source tile.
// Tiles in TUTORIAL_GIVEN start in place; the others start turned and are
// fixed in walkthrough order (the test checks the order matches the words).
export const TUTORIAL_SOLUTION = [
  [6, 10, 14, 8],
  [5, 4, 5, 4],
  [7, 9, 7, 9],
  [1, 2, 11, 8],
];
export const TUTORIAL_SOURCE = 10; // row 3, column 3
export const TUTORIAL_GIVEN = [2, 3, 4, 6, 7, 9, 10, 11, 12, 14];
export const TUTORIAL_TAPS = { 0: 2, 1: 1, 8: 1, 5: 2, 13: 2, 15: 1 };
export const TUTORIAL_WORDS = [
  { title: 'Corners point inward',
    text: 'Every pipe must join up, and nothing can point off the board. A bend in the corner only fits one way: with both ends pointing into the board. Tap it to turn it until it does.' },
  { title: 'Straight along the edge',
    text: 'A straight pipe on the edge can\'t point off the board, so it has to run along the edge. Tap to turn it.' },
  { title: 'T-pieces face inward',
    text: 'A T-piece on the edge keeps its flat side against the wall, so all three ends point into the board.' },
  { title: 'Follow the pipe pointing at you',
    text: 'This dead end has one opening and must connect. Of the pipes around it, only the one below points at it. Turn it to face down.' },
  { title: 'Same idea',
    text: 'Only the pipe on its right points at this dead end. Turn it to face right.' },
  { title: 'Last connection',
    text: 'Point the final dead end at the pipe beside it and the whole network lights up.' },
];
