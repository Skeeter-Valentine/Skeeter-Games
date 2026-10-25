import { mulberry32 } from './puzzle.js';
import { scheduledDifficulty } from '../../utils/dailySchedule.js';

// From this day, each pepper level sets both the board size and how much
// logic the puzzle needs ("advanced steps", see grader.js). Earlier dailies
// keep their original boards (size only), so past puzzles never change.
// Change only to a later date, and only for days nobody has seen.
export const HASHI_LEVELS_FROM = '2026-10-26';
export const HASHI_LEVELS = [
  // Mild: counting each island's bridges is enough.
  { sizes: [6, 7], steps: [0, 0] },
  // Medium: a bigger board with a step or two past counting.
  { sizes: [8], steps: [1, 2] },
  // Picante: a big board that keeps making you think ahead.
  { sizes: [10], steps: [4, Infinity] },
];
const ORIGINAL_SIZES = [[5], [6, 7], [8]];

export function getDailyConfig(date) {
  const rng = mulberry32(parseInt(date.replace(/-/g, ''), 10));
  const level = scheduledDifficulty('hashi', date);
  const graded = date >= HASHI_LEVELS_FROM;
  const sizes = graded ? HASHI_LEVELS[level - 1].sizes : ORIGINAL_SIZES[level - 1];
  const size = sizes[Math.floor(rng() * sizes.length)];
  // Return the advanced generator so puzzle generation keeps its existing sequence.
  return { size, rng, level, steps: graded ? HASHI_LEVELS[level - 1].steps : null };
}
