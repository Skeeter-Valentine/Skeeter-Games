// Rotate a balanced seven-day schedule: each game gets two Mild days,
// two Picante days, and three Medium days. Neither extreme touches itself,
// including where the cycle wraps. Fixed-difficulty games remain Medium.
export const scheduledGames = ['parshle', 'pipes', 'shikaku', 'nonograms', 'hashi', 'stitches', 'minesweeper', 'akari', 'map', 'skeedle-beadle', 'pepper-placer', 'kakurasu', 'slitherlink', 'chess'];
const cycle = [1, 3, 1, 3, 2, 2, 2];

// Skeetmate (chess), from the week of CHESS_WEEKS_FROM: each Monday-to-Sunday
// week has two Mild, two Medium and three Picante puzzles in a random order
// (the same for everyone, drawn from the week's date). As with the cycle, a
// Mild or Picante day never follows another of the same, across weeks too.
// Earlier days keep the cycle above.
export const CHESS_WEEKS_FROM = '2026-11-23';
const chessWeek = [1, 1, 2, 2, 3, 3, 3];
function weekOrder(monday, before) {
  let state = 2166136261;
  for (const char of `skeetmate-week-v1:${monday}`) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const repeats = order => order.some((level, i) => level !== 2 && level === (i ? order[i - 1] : before));
  for (;;) {
    const order = [...chessWeek];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    if (!repeats(order)) return order;
  }
}
const DAY = 86400000;
const isoDay = day => new Date(day * DAY).toISOString().slice(0, 10);
const FIRST_MONDAY = Date.parse(`${CHESS_WEEKS_FROM}T00:00:00Z`) / DAY;
// Weeks are worked out in order from the first, each after the one before.
const chessWeeks = [];
function chessLevel(day) {
  const week = Math.floor((day - FIRST_MONDAY) / 7);
  while (chessWeeks.length <= week) {
    const monday = FIRST_MONDAY + chessWeeks.length * 7;
    const before = chessWeeks.length ? chessWeeks.at(-1)[6] : cycle[((monday - 1 + scheduledGames.indexOf('chess')) % 7 + 7) % 7];
    chessWeeks.push(weekOrder(isoDay(monday), before));
  }
  return chessWeeks[week][day - FIRST_MONDAY - week * 7];
}

export function scheduledDifficulty(game, date) {
  const index = scheduledGames.indexOf(game);
  if (index === -1) return 2;
  const day = Date.parse(`${date}T00:00:00Z`) / 86400000;
  if (!Number.isInteger(day) || new Date(day * 86400000).toISOString().slice(0, 10) !== date) {
    throw new RangeError('Expected a valid YYYY-MM-DD date');
  }
  if (game === 'chess' && date >= CHESS_WEEKS_FROM) return chessLevel(day);
  return cycle[((day + index) % cycle.length + cycle.length) % cycle.length];
}
