// "Share result" for the daily games: a short, spoiler-free summary with a
// link, like Wordle's. The Skeeter Gauntlet has its own (gauntlet.js).
import { formatDuration } from './dailyStats.js';

// Games whose daily puzzle has a pepper (difficulty) rating.
export const RATED_GAMES = ['map', 'akari', 'skeedle-beadle', 'pepper-placer', 'kakurasu', 'slitherlink', 'parshle',
  'nonograms', 'stitches', 'pipes', 'shikaku', 'minesweeper', 'hashi'];

export const shareDay = date => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

// Emoji squares for word-game feedback.
const SQUARES = { correct: '🟩', green: '🟩', present: '🟨', yellow: '🟨', absent: '⬜', default: '⬜', hidden: '⬛' };
export const emojiRow = colors => colors.map(color => SQUARES[color] ?? '⬜').join('');

export function dailyShareText({ title, date, archive = false, won, seconds, guesses, maxGuesses, level, grid = [], url }) {
  const heading = `${title} · ${archive ? 'Archive · ' : ''}${shareDay(date)}${level ? ` · ${'🌶️'.repeat(level)}` : ''}`;
  const time = Number.isFinite(seconds) ? formatDuration(seconds) : null;
  let line;
  if (maxGuesses) line = `${won ? '✅' : '❌'} ${won ? guesses : 'X'}/${maxGuesses}${won && time ? ` · ${time}` : ''}`;
  else line = won ? `✅ Solved${time ? ` in ${time}` : ''}` : '❌ Not solved this time';
  return [heading, line, ...grid, url.replace(/^https?:\/\//, '')].join('\n');
}

// Opens the phone's share sheet where there is one, otherwise copies.
// Returns 'shared', 'copied', 'cancelled' or 'failed'.
export async function shareResult(text, nav = globalThis.navigator, win = globalThis.window) {
  const touch = !!win?.matchMedia?.('(pointer: coarse)').matches;
  if (touch && nav?.share) {
    try { await nav.share({ text }); return 'shared'; }
    catch (error) { if (error?.name === 'AbortError') return 'cancelled'; }
  }
  try { await nav.clipboard.writeText(text); return 'copied'; }
  catch { return 'failed'; }
}

// Ske4dle: the guess each word was solved on (as keycap digits), 🟥 if not.
const KEYCAPS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
export function quordleShareGrid(words, guesses) {
  const cells = words.map(word => { const at = guesses.indexOf(word) + 1; return at > 0 ? KEYCAPS[at] ?? String(at) : '🟥'; });
  return [cells.slice(0, 2).join(''), cells.slice(2, 4).join('')];
}
