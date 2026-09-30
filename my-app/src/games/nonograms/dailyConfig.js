import { scheduledDifficulty } from '../../utils/dailySchedule.js';

export function getDailySize(date) {
  return [5, 10, 15][scheduledDifficulty('nonograms', date) - 1];
}
