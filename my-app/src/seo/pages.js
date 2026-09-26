import { gameInstructions } from '../components/gameInstructions.js';

const entries = [
  ['stitches', 'Skitches', 'Daily Stitches Puzzle', 'Connect jagged blocks with stitches while matching the hole counts around the grid.', 'If two neighboring blocks share three boundary edges, choose just one stitch between them. That stitch adds one hole at each endpoint.'],
  ['nonograms', 'Skeedograms', 'Daily Nonogram Puzzles', 'Use row and column clues to reveal a hidden pixel pattern in this nonogram logic game.', 'In a five-cell row, the clue 3, 1 fills the first three cells, leaves one empty, then fills the last cell.'],
  ['hashi', 'Hashkeet', 'Hashi Bridges Puzzles', 'Connect numbered islands into one network in this online Hashi logic puzzle.', 'An island marked 3 with only two possible neighbors needs a double bridge to one and a single bridge to the other.'],
  ['shikaku', 'Shikaku', 'Rectangle Logic Puzzles', 'Partition the grid into rectangles, each containing one clue equal to its area.', 'A clue of 6 can occupy a 1 × 6 or 2 × 3 rectangle, including rotated versions. Eliminate shapes that contain another clue.'],
  ['sudoku', 'Skeedoku', 'Free Online Sudoku', 'Play number-placement puzzles using row, column, and box logic, with notes for possible values.', 'If a standard row contains every digit except 7, its remaining empty cell must be 7. Check the column and box too.'],
  ['2048', '2048', 'Number Tile Puzzle', 'Slide and combine matching numbered tiles to build a 2048 tile.', 'Sliding a row of 2, 2, 4, empty to the left produces 4, 4, empty, empty before the new tile appears. The new 4 does not merge again on that move.'],
  ['minesweeper', 'Mineskeeter', 'Online Minesweeper', 'Use nearby mine counts to uncover safe cells and clear the board.', 'If a revealed 1 touches exactly one unopened cell, that cell contains a mine. Flag it before considering nearby safe moves.'],
  ['pipes', 'Skeeter Piper', 'Pipe Connection Puzzle', 'Rotate pipes to connect every tile to the server with no unmatched openings.', 'A corner pipe at the top-left of the board must face right and down: the other orientations point outside the board.'],
  ['nerdle', 'Skeedle+', 'Daily Math Equation Puzzle', 'Discover a hidden equation using arithmetic and colored feedback from your guesses.', 'A yellow equals sign means your equation needs the equals sign in a different position. Every new guess must still be a valid equation.'],
  ['quordle', 'Ske4dle', 'Four Word Puzzle', 'Solve four five-letter words together using shared guesses and separate feedback.', 'A letter may be green on one board and absent on another. Track each word separately while choosing guesses that help several boards.'],
  ['word500', 'Skeedle500', 'Word Deduction Puzzle', 'Find a five-letter word from totals of matching letters rather than individual letter colors.', 'Two green matches mean two letters have the right positions, but the feedback does not say which two. Compare guesses to work them out.'],
  ['skeedle-marathon', 'Skeedle Marathon', '26 Word Puzzle Challenge', 'Solve 26 five-letter words with a shared pool of guesses in this extended word challenge.', 'A guess that solves one board also gives feedback on every unsolved board. Use that feedback before spending another guess.'],
  ['map', 'Map', 'Four Color Map Puzzle', 'Color a map with four colors so that regions sharing an edge have different colors.', 'If a region borders fixed red, blue, and green regions, choose the fourth color. A neighbor touching only at a corner does not restrict it.'],
];
export const pages = Object.fromEntries(entries.map(([id, name, topic, description, example]) => [`/${id}`, {
  path: `/${id}`, name, title: `${name} — ${topic} | Skeeter Games`, topic, description, example, rules: gameInstructions[id],
}]));
pages['/'] = { path: '/', name: 'Skeeter Games', title: 'Free Logic, Word & Number Puzzles | Skeeter Games', topic: 'Free online logic, word, and number puzzles', description: 'Play Sudoku, nonograms, Hashi, Stitches, word puzzles, and more at Skeeter Games. Explore daily challenges and sharpen your puzzle-solving skills.' };
export function pageFor(pathname) { return pages[pathname.replace(/\/+$/, '') || '/']; }
