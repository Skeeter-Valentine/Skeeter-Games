import { mulberry32 } from './puzzle.js';
import { scheduledDifficulty } from '../../utils/dailySchedule.js';

export function getDailyConfig(date) {
  const rng = mulberry32(parseInt(date.replace(/-/g, ''), 10));
  const sizes = [[5], [6, 7], [8]][scheduledDifficulty('hashi', date) - 1];
  const size = sizes[Math.floor(rng() * sizes.length)];
  // Return the advanced generator so puzzle generation keeps its existing sequence.
  return { size, rng };
}
