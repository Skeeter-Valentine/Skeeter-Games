// The Skeeterlink "Learn to play" walkthrough: a 3 x 3 board. Edges use the
// game's numbering (see puzzle.js): horizontal sides 0-11 row by row, then
// vertical sides 12-23. In each step the player draws (`action: 'line'`) or
// crosses off (`action: 'cross'`) the glowing sides; `auto` sides are crossed
// off for them when the step is done. `cells` are the squares the step is
// about.
export const TUTORIAL_PUZZLE = { rows: 3, cols: 3, clues: [2, 2, 2, 2, 0, 3, 2, 3, 2] };
export const TUTORIAL_SOLUTION = [0, 1, 5, 6, 8, 10, 12, 14, 16, 19, 21, 22];
export const TUTORIAL_STEPS = [
  { action: 'cross', targets: [4, 7, 17, 18], auto: [], cells: [4],
    title: 'A 0 uses none of its sides',
    text: 'Each number says how many sides of its square the loop runs along. The loop never touches the middle square, so cross off all four of its sides. Switch to Cross × in the game, or tap each glowing side here.' },
  { action: 'line', targets: [5, 19, 8, 21, 10, 22], auto: [], cells: [5, 7],
    title: 'A 3 next to a 0',
    text: 'Each 3 needs three of its four sides, and the side it shares with the 0 is crossed off. So its other three sides are all part of the loop. Draw them (drag along them, or tap each one).' },
  { action: 'line', targets: [6, 14], auto: [], cells: [],
    title: 'Lines never stop at a dot',
    text: 'The loop passes through a dot with exactly two lines, or skips it. Two lines end at dots where every other way out is crossed off, so each must keep going the only way it can.' },
  { action: 'cross', targets: [9, 20], auto: [11, 23, 2, 15], cells: [6, 8, 2],
    title: 'A full 2',
    text: 'The bottom-left 2 already has its two lines, so its other two sides are crossed off. Cross them. The other corner 2s are full too, so their spare sides get crossed off for you.' },
  { action: 'line', targets: [16, 1], auto: [3, 13], cells: [],
    title: 'Keep going',
    text: 'The loop has two loose ends. At each one, only one way out is left. Draw them. That fills the 2s beside them, so the sides between the top-left square and its neighbours are crossed off.' },
  { action: 'line', targets: [12, 0], auto: [], cells: [0],
    title: 'Close the loop',
    text: 'Two sides of the top-left square join the loose ends into one loop. Draw them to finish: one loop, and every number satisfied.' },
];
