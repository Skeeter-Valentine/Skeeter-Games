// The Skeedograms "Learn to play" walkthrough: a 5 x 5 heart, solved with
// the basic nonogram moves. Cells are numbered row * 5 + column. Each step
// fills (or crosses) its targets; `focus` names the clues it's about
// ('r0' is the first row's clue, 'c2' the third column's).
export const TUTORIAL_SIZE = 5;
export const TUTORIAL_PICTURE = [
  '.#.#.',
  '#####',
  '#####',
  '.###.',
  '..#..',
].map(row => row.split('').map(ch => ch === '#'));

const cell = (r, c) => r * TUTORIAL_SIZE + c;
const row = r => Array.from({ length: TUTORIAL_SIZE }, (_, c) => cell(r, c));

export const TUTORIAL_STEPS = [
  { action: 'fill', focus: ['r1'], targets: row(1),
    title: 'A 5 fills the whole row',
    text: 'Each number is a block of filled squares in that row. This row is 5 squares wide and its clue is 5, so every square is filled. Drag across it, or tap each glowing square.' },
  { action: 'fill', focus: ['r2'], targets: row(2),
    title: 'Same again',
    text: 'The next row is another 5. Fill it in.' },
  { action: 'fill', focus: ['c1', 'c2', 'c3'], targets: [cell(3, 1), cell(3, 2), cell(3, 3)],
    title: 'Where blocks must overlap',
    text: 'These three columns each need a block of 4 in 5 squares. It can start at the top or one square down, and either way it covers the middle three. So the fourth square down is filled in each.' },
  { action: 'cross', focus: ['r3'], targets: [cell(3, 0), cell(3, 4)],
    title: 'A finished row',
    text: 'This row\'s clue is 3, and it already has its block of 3. The other squares must be empty: mark them with a cross. Crosses are just notes to help you.' },
  { action: 'fill', focus: ['r0', 'c0', 'c4'], targets: [cell(0, 1), cell(0, 3)],
    title: 'Counting the gaps',
    text: 'The outer columns already have their 2, so the top corners are empty. That leaves three squares for "1 1": two blocks need a gap between them, so it can only be filled, empty, filled.' },
  { action: 'fill', focus: ['c2'], targets: [cell(4, 2)],
    title: 'The last square',
    text: 'The middle column needs a block of 4, and its top square is the gap you just found. So the block runs to the bottom. Fill it to finish the picture.' },
];

// Clues for a picture: the lengths of each run of filled squares.
export function clues(lines) {
  return lines.map(line => {
    const runs = [];
    let run = 0;
    for (const filled of line) {
      if (filled) run++;
      else if (run) { runs.push(run); run = 0; }
    }
    if (run) runs.push(run);
    return runs.length ? runs : [0];
  });
}
