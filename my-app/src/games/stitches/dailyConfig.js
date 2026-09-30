import { scheduledDifficulty } from '../../utils/dailySchedule.js';

export function getDailySize(date) {
  return [5, 7, 9][scheduledDifficulty('stitches', date) - 1];
}
