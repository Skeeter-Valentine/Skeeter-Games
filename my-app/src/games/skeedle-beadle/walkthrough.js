// Skeedle Beadle "Learn to play": a five-stick board (three bead types, two
// empty sticks) sorted in eight scripted moves, each teaching one idea.
// Sticks are listed bottom to top: 0 red circle, 1 orange triangle, 2 yellow square.
export const TUTORIAL_START = [[1, 0, 0], [0, 2, 1], [2, 2, 1, 0], [1, 2], []];

export const TUTORIAL_MOVES = [
  { from: 2, to: 0, lesson: 'match' },
  { from: 2, to: 4, lesson: 'empty' },
  { from: 1, to: 4, lesson: 'build' },
  { from: 3, to: 2, lesson: 'dig' },
  { from: 3, to: 4, lesson: 'freed' },
  { from: 1, to: 2, lesson: 'finish' },
  { from: 0, to: 1, lesson: 'together' },
  { from: 0, to: 4, lesson: 'last' },
];
