import { scheduledDifficulty } from '../../utils/dailySchedule.js';

export function getDailyGridSize(dateStr) {
  const sizes = [5, 7, 9];
  return sizes[scheduledDifficulty('pipes', dateStr) - 1];
}
