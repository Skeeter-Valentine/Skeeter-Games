// Peppers: the weekly "top pepper pickers" leaderboard. Pure rules, shared by
// the Cloud Functions in index.js and tested in peppers.test.mjs.
//
// - Solving today's daily puzzle earns its chili rating (1-3 peppers).
// - Solving a Skeeter Gauntlet game earns that game's chili rating too.
// - Finishing a gauntlet (all six games played) adds a 5-pepper bonus.
// Weeks start Monday at 4am Colorado time, like the gauntlet's days.
import { dailyDifficulty } from './shared/utils/dailyDifficulty.js';
import { gauntletDay, isTestDay } from './gauntlet.js';

export const GAUNTLET_BONUS = 5;
const DAY = 86400000;
const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

// The Monday (YYYY-MM-DD) that starts the pepper week containing `now`.
export function pepperWeek(now) {
  const day = gauntletDay(now);
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

// A first win on a daily puzzle (today's, or yesterday's for a game that
// crossed midnight UTC). Archive and practice games don't earn peppers.
export function dailyPeppers({ game, date, mode, status }, firstWin, now) {
  if (!firstWin || mode !== 'daily' || status !== 'won') return 0;
  const today = new Date(now).toISOString().slice(0, 10);
  if (date !== today && date !== addDays(today, -1)) return 0;
  return dailyDifficulty(game, date);
}

// Gauntlet games use their own puzzles (dated 20000 days ahead, as on the site).
export const gauntletGamePeppers = (day, game) => dailyDifficulty(game, addDays(day, 20000));

// Peppers for one gauntlet "finish" event. Test gauntlets never count.
export function gauntletPeppers(day, run, finished) {
  if (isTestDay(day) || !run?.results?.length) return 0;
  const last = run.results.at(-1);
  return (last.status === 'won' ? gauntletGamePeppers(day, last.game) : 0) + (finished ? GAUNTLET_BONUS : 0);
}
