import { useGauntlet } from './DailyBoundary';
import { rowBonus } from '../gauntlet/gauntlet.js';
import './GuessBonus.css';

// Skeeter Gauntlet word games: the time taken off for solving on this guess
// row (5 seconds per guess left over), shown beside the row. Nothing outside
// the gauntlet.
//   row: 0 for the first guess; used: guesses made so far; won: game solved.
// The label sits just right of its parent, which gets the guess-bonus-row
// class, so it never moves or shrinks the board.
export default function GuessBonus({ gameId, row, used = 0, won = false }) {
  const gauntlet = useGauntlet();
  if (!gauntlet) return null;
  const seconds = rowBonus(gameId, row);
  if (!seconds) return null;
  const earned = won && row === used - 1;
  const state = earned ? 'earned' : row < used ? 'past' : row === used && !won ? 'current' : 'open';
  return <span className={`guess-bonus guess-bonus-${state}`}
    title={`Solve on guess ${row + 1}: ${seconds} seconds off your time`}>−{seconds}s</span>;
}
