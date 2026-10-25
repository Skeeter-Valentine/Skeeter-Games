import { lineOptions } from './puzzle.js';

// The Add ’em Up "Learn to play" walkthrough: a 4 x 4 board solved one row
// or column at a time. Squares are numbered row * 4 + column. In each step
// the player taps `shade` (or, if there's nothing to shade, marks `clear`);
// the step's other `clear` squares are crossed off for them.
export const TUTORIAL_PUZZLE = { size: 4, rows: [5, 2, 10, 3], cols: [4, 5, 7, 4] };
export const TUTORIAL_STEPS = [
  { kind: 'row', index: 2, shade: [8, 9, 10, 11], clear: [],
    title: 'Squares count by position',
    text: 'A shaded square is worth its column number (1 to 4) in its row. This row needs 10, and 1 + 2 + 3 + 4 = 10, so every square is shaded. Drag across it, or tap each glowing square.' },
  { kind: 'row', index: 1, shade: [5], clear: [4, 6, 7],
    title: 'Only one way to make 2',
    text: 'This row needs 2. A square can only count once, so 1 + 1 is out: the only way is the square in column 2. The rest of the row stays empty, so it gets crossed off for you.' },
  { kind: 'col', index: 2, shade: [14], clear: [2],
    title: 'Columns count by row',
    text: 'Down a column, a shaded square is worth its row number. Column 3 needs 7 and already has 3 (row 3). Row 2 is crossed off, so the other 4 can only come from row 4.' },
  { kind: 'row', index: 3, shade: [], clear: [12, 13, 15],
    title: 'A finished row',
    text: 'The bottom row needs 3, and its shaded square in column 3 already makes 3. Mark the rest of the row empty: tap each glowing square to cross it off.' },
  { kind: 'col', index: 0, shade: [0], clear: [],
    title: 'What\'s left over',
    text: 'Column 1 needs 4 and has 3 so far (row 3). It needs 1 more, and only row 1 is worth 1. Shade it.' },
  { kind: 'row', index: 0, shade: [3], clear: [1],
    title: 'The last square',
    text: 'The top row needs 5 and has 1. Column 3 is crossed off, and column 2 would only make 3, so the 4 in column 4 finishes it.' },
];

// What one row or column alone proves on `grid` (1 shaded, 2 empty, 0 unknown).
export function lineDeduction(puzzle, grid, kind, index) {
  const { size } = puzzle;
  const cells = Array.from({ length: size }, (_, i) => kind === 'row' ? index * size + i : i * size + index);
  const clue = (kind === 'row' ? puzzle.rows : puzzle.cols)[index];
  const fits = lineOptions(size, clue).filter(mask => cells.every((id, i) => !grid[id] || (grid[id] === 1) === !!(mask >> i & 1)));
  const all = fits.reduce((acc, mask) => acc & mask, (1 << size) - 1);
  const any = fits.reduce((acc, mask) => acc | mask, 0);
  return {
    shade: cells.filter((id, i) => !grid[id] && all >> i & 1),
    clear: cells.filter((id, i) => !grid[id] && !(any >> i & 1)),
  };
}
