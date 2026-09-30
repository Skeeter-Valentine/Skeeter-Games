import { getDailyGridSize as shikakuSize } from '../games/shikaku/puzzle.js';
import { getDailyGridSize as pipesSize } from '../games/pipes/dailyConfig.js';
import { getDailyBoardConfig } from '../games/minesweeper/dailyConfig.js';
import { getDailyConfig } from '../games/hashi/dailyConfig.js';
import { getDailySize as nonogramsSize } from '../games/nonograms/dailyConfig.js';
import { getDailySize as stitchesSize } from '../games/stitches/dailyConfig.js';
import { hiddenPositions } from '../games/parshle/logic.js';
import { scheduledDifficulty } from './dailySchedule.js';

export { dailyDate } from './dailyClock.js';

// Difficulty is relative to each game's daily range, not its practice settings.
export function dailyDifficulty(game, date) {
  switch (game) {
    case 'akari': return scheduledDifficulty('akari', date);
    case 'parshle': {
      const hiddenCount = Array.from({ length: 5 }, (_, row) =>
        hiddenPositions(`parshle:${date}`, row).length).reduce((sum, count) => sum + count, 0);
      return hiddenCount <= 7 ? 1 : hiddenCount <= 9 ? 2 : 3;
    }
    case 'nonograms': return { 5: 1, 10: 2, 15: 3 }[nonogramsSize(date)];
    case 'stitches': return { 5: 1, 7: 2, 9: 3 }[stitchesSize(date)];
    case 'pipes': return { 5: 1, 7: 2, 9: 3 }[pipesSize(date)];
    case 'shikaku': return { 5: 1, 7: 1, 10: 2, 15: 3, 20: 3 }[shikakuSize(date)];
    case 'minesweeper': {
      const { rows, cols } = getDailyBoardConfig(date);
      const cells = rows * cols;
      return cells <= 144 ? 1 : cells <= 196 ? 2 : 3;
    }
    case 'hashi': return { 5: 1, 6: 2, 7: 2, 8: 3 }[getDailyConfig(date).size];
    default: return 2;
  }
}
