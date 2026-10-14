// Daily fastest-times leaderboards: one per game per daily puzzle, at
// dailyBoard/{game}_{date}/entries/{uid}. Only a player's first win on today's
// puzzle (or yesterday's, for a game that crossed midnight UTC) is listed.
// Solve times come from the player's browser, so obviously impossible times
// are refused.
export const MIN_DAILY_SECONDS = 3;
const DAY = 86400000;

export function isCurrentDaily(date, now) {
  const today = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - DAY).toISOString().slice(0, 10);
  return date === today || date === yesterday;
}

// The time to list for this report, or null when it doesn't belong on a board.
export function dailyBoardSeconds({ date, mode, status, seconds }, firstWin, now) {
  if (!firstWin || mode !== 'daily' || status !== 'won' || !Number.isInteger(seconds) || seconds < MIN_DAILY_SECONDS) return null;
  return isCurrentDaily(date, now) ? seconds : null;
}

export const dailyBoardId = (game, date) => `${game}_${date}`;

// Board documents a nickname change should rename: today's and yesterday's
// boards for every game.
export function recentBoardIds(games, now) {
  const today = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - DAY).toISOString().slice(0, 10);
  return games.flatMap(game => [dailyBoardId(game, today), dailyBoardId(game, yesterday)]);
}
