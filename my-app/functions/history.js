import { isTestDay } from './gauntlet.js';

// A signed-in player's results, saved on their account (players/{uid}) so
// streaks and stats follow them from device to device:
//   gauntletHistory: { [day]: { total, solved } }        (gauntletEvent)
//   dailyHistory: { [game]: { [date]: { won, seconds } } } (recordPuzzleAttempt)
// The site merges these with what the device saved (see src/utils/dailyStats.js
// and src/gauntlet/gauntlet.js mergeHistory).

// The history update for a finished gauntlet run, or null (test gauntlets
// and unfinished runs aren't kept).
export function gauntletHistoryUpdate(day, run) {
  if (!run?.finishedAt || isTestDay(day) || !Array.isArray(run.results)) return null;
  const total = run.results.reduce((sum, result) => sum + (Number(result.total) || 0), 0);
  const solved = run.results.filter(result => result.status === 'won').length;
  return { gauntletHistory: { [day]: { total, solved } } };
}

// The history update for a daily puzzle's final result (the first win or
// loss of today's puzzle), or null. Archive plays don't count toward streaks.
export function dailyHistoryUpdate(attempt) {
  if (attempt?.mode !== 'daily' || !['won', 'lost'].includes(attempt.status)) return null;
  return { dailyHistory: { [attempt.game]: { [attempt.date]: { won: attempt.status === 'won', seconds: attempt.status === 'won' ? attempt.seconds ?? null : null } } } };
}

export const signedIn = auth => !!auth && auth.token?.firebase?.sign_in_provider !== 'anonymous';
