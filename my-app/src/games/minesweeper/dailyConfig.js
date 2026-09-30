import { getDailySeed } from '../shikaku/puzzle.js';
import { scheduledDifficulty } from '../../utils/dailySchedule.js';

export function getDailyBoardConfig(dateStr) {
  const configs = [
    { rows: 9, cols: 9, mines: 10 },
    { rows: 12, cols: 12, mines: 22 },
    { rows: 14, cols: 14, mines: 30 },
    { rows: 16, cols: 16, mines: 40 },
    { rows: 16, cols: 30, mines: 99 },
  ];
  const seed = getDailySeed(dateStr + '-minesweeter');
  const indices = [[0, 1], [2], [3, 4]][scheduledDifficulty('minesweeper', dateStr) - 1];
  return configs[indices[seed % indices.length]];
}
