import { puzzleSnapshot } from '../utils/archive.js';
import { getDailyTargetWord, getParshleDailyTargetWord } from '../games/word500/constants/wordBank';
import { getDailyTargetWords } from '../games/quordle/constants/wordBank';
import { generateEquation } from '../games/skeedlemath/equations.js';

// A word game's answer for a gauntlet, worked out the same way the game picks
// it (from the puzzle date), so a lost game's answer can always be shown,
// even when the run was played on another device. null for other games.
const ANSWERS = {
  word500: date => puzzleSnapshot('word500', date, () => getDailyTargetWord(date)),
  quordle: date => puzzleSnapshot('quordle', date, () => getDailyTargetWords(date)).join(', '),
  parshle: date => getParshleDailyTargetWord(date),
  skeedlemath: date => puzzleSnapshot('skeedlemath', date, () => generateEquation(true, date)),
};
export function gauntletAnswer(gameId, puzzleDate) {
  try {
    const answer = ANSWERS[gameId]?.(puzzleDate);
    return typeof answer === 'string' && answer ? answer : null;
  } catch {
    return null;
  }
}
