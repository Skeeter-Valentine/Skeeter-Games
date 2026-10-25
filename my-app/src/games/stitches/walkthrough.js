// The Skitches "Learn to play" walkthrough: a 5 x 5 board of five blocks,
// solved with the basic moves. Cells are numbered row * 5 + column, and a
// stitch is the game's edge id `${cell}-${cell to its right or below}`.
// `focus` names what a step is about: 'b0' is block 0 (all its cells),
// 'r2' the third row's clue, 'c0' the first column's.
const LAYOUT = [
  'AAABB',
  'ACCBB',
  'ACCDD',
  'EECDD',
  'EEEDD',
];
export const TUTORIAL_REGIONS = LAYOUT.map(row => row.split('').map(ch => ch.charCodeAt(0) - 65));
export const TUTORIAL_PUZZLE = { regions: TUTORIAL_REGIONS, rows: [3, 4, 5, 2, 2], cols: [2, 4, 4, 4, 2] };

const at = (r, c) => r * 5 + c;
const right = (r, c) => `${at(r, c)}-${at(r, c + 1)}`;
const down = (r, c) => `${at(r, c)}-${at(r + 1, c)}`;

export const TUTORIAL_STEPS = [
  { focus: ['b0', 'b1'], targets: [right(0, 2)],
    title: 'Every neighbor gets one stitch',
    text: 'Each pair of touching blocks needs exactly one stitch across their border. The pink and blue blocks only touch in one spot, so the stitch has to go there. Tap the glowing border.' },
  { focus: [], targets: [right(1, 2), down(2, 0), right(4, 2)],
    title: 'More pairs that touch once',
    text: 'Three more pairs only share one short border: blue and orange, pink and purple, purple and green. Stitch all three.' },
  { focus: ['b1', 'b3'], targets: [down(1, 4)],
    title: 'Holes can\'t be shared',
    text: 'Each end of a stitch is a hole, and a cell can only be one hole. Blue and green touch in two places, but one of them is already a hole. So the stitch goes in the other spot.' },
  { focus: ['r2'], targets: [down(2, 1), right(2, 2)],
    title: 'Counting holes',
    text: 'The numbers outside count the holes in each row and column. This row needs 5, so every cell in it is a hole. The two cells without one yet can each only be finished by one pair that still needs a stitch.' },
  { focus: ['c0'], targets: [down(0, 1)],
    title: 'A finished column',
    text: 'The first column needs 2 holes, and it has them. So the pink and orange stitch can\'t start in that column: it must go across the top border instead.' },
];
