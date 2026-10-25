// The Skeedoku "Learn to play" walkthrough on a 4 x 4 mini board (2 x 2
// boxes): the three basic sudoku moves, one square at a time. Cells are
// numbered row * 4 + column. Each step is { reason, cell, digit, group? }:
//  lastInGroup  a row, column or box with one empty square left
//  onlySpot     the only square in a row, column or box where a number fits
//  onlyNumber   a square whose row, column and box already hold every other number
const N = 4, BOX = 2;
const rowOf = id => Math.floor(id / N), colOf = id => id % N;
const boxOf = id => Math.floor(rowOf(id) / BOX) * BOX + Math.floor(colOf(id) / BOX);
export const GROUPS = [
  ...Array.from({ length: N }, (_, r) => ({ kind: 'row', index: r, cells: Array.from({ length: N }, (__, c) => r * N + c) })),
  ...Array.from({ length: N }, (_, c) => ({ kind: 'column', index: c, cells: Array.from({ length: N }, (__, r) => r * N + c) })),
  ...Array.from({ length: N }, (_, b) => ({ kind: 'box', index: b, cells: Array.from({ length: N * N }, (__, id) => id).filter(id => boxOf(id) === b) })),
];
export const peers = id => Array.from({ length: N * N }, (_, other) => other)
  .filter(other => other !== id && (rowOf(other) === rowOf(id) || colOf(other) === colOf(id) || boxOf(other) === boxOf(id)));

// Whether a move is a fair deduction on `grid` (0 = empty), for its reason.
export function explains(grid, { reason, cell, digit, group }) {
  if (grid[cell]) return false;
  const fits = (id, d) => !grid[id] && peers(id).every(other => grid[other] !== d);
  if (!fits(cell, digit)) return false;
  if (reason === 'lastInGroup') return group.cells.includes(cell) && group.cells.filter(id => !grid[id]).length === 1;
  if (reason === 'onlySpot') return group.cells.filter(id => fits(id, digit)).length === 1 && group.cells.filter(id => !grid[id]).length > 1;
  if (reason === 'onlyNumber') return [1, 2, 3, 4].filter(d => fits(cell, d)).length === 1;
  return false;
}

// The walkthrough board and its steps. Each step is two taps: the square,
// then the number.
const group = (kind, index) => GROUPS.find(entry => entry.kind === kind && entry.index === index);
export const TUTORIAL_SOLUTION = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];
export const TUTORIAL_PUZZLE = [1, 2, 3, 0, 0, 0, 1, 2, 2, 1, 0, 3, 4, 3, 0, 0];
export const TUTORIAL_STEPS = [
  { reason: 'lastInGroup', cell: 3, digit: 4, group: group('row', 0),
    title: 'The last square in a row',
    text: 'Every row, column and 2 x 2 box holds 1, 2, 3 and 4 once each. The top row already has 1, 2 and 3, so its empty square is 4. Tap the square, then tap 4.' },
  { reason: 'onlySpot', cell: 5, digit: 4, group: group('box', 0),
    title: 'Only one spot for a number',
    text: 'The top-left box needs a 4. The left-hand column already has a 4 (at the bottom), so the box\'s empty square in that column can\'t be 4. That leaves one spot.' },
  { reason: 'onlyNumber', cell: 14, digit: 2, group: null,
    title: 'Only one number fits',
    text: 'Look at what this square can\'t be: its row has 3 and 4, and its column has 1. The only number left is 2.' },
  { reason: 'lastInGroup', cell: 4, digit: 3, group: group('row', 1),
    title: 'Fill in the gaps',
    text: 'The second row has one empty square left. Which number is missing?' },
  { reason: 'lastInGroup', cell: 10, digit: 4, group: group('row', 2),
    title: 'Another last square',
    text: 'Same again in the third row.' },
  { reason: 'lastInGroup', cell: 15, digit: 1, group: group('row', 3),
    title: 'The final number',
    text: 'One square left. Fill it in to finish the board.' },
];
