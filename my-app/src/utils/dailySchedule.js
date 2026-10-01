// Rotate a balanced seven-day schedule: each game gets two Mild days,
// two Picante days, and three Medium days. Neither extreme touches itself,
// including where the cycle wraps. Fixed-difficulty games remain Medium.
export const scheduledGames = ['parshle', 'pipes', 'shikaku', 'nonograms', 'hashi', 'stitches', 'minesweeper', 'akari', 'map'];
const cycle = [1, 3, 1, 3, 2, 2, 2];

export function scheduledDifficulty(game, date) {
  const index = scheduledGames.indexOf(game);
  if (index === -1) return 2;
  const day = Date.parse(`${date}T00:00:00Z`) / 86400000;
  if (!Number.isInteger(day) || new Date(day * 86400000).toISOString().slice(0, 10) !== date) {
    throw new RangeError('Expected a valid YYYY-MM-DD date');
  }
  return cycle[((day + index) % cycle.length + cycle.length) % cycle.length];
}
