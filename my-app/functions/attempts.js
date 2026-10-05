export const games = ['map', '2048', 'akari', 'hashi', 'minesweeper', 'nonograms', 'parshle', 'pipes', 'quordle', 'shikaku', 'skeedle-marathon', 'skeedlemath', 'stitches', 'sudoku', 'word500', 'skeedle-beadle'];

export function validateAttempt(data, today) {
  if (!data || data.version !== 'v1' || !games.includes(data.game) || !['daily', 'archive'].includes(data.mode)
    || !['started', 'won', 'lost'].includes(data.status) || typeof data.date !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !Number.isFinite(Date.parse(`${data.date}T00:00:00Z`))
    || new Date(`${data.date}T00:00:00Z`).toISOString().slice(0, 10) !== data.date
    || data.date < '2026-08-20' || data.date > today || (data.mode === 'archive' && data.date >= today)
    || !(data.seconds === null || (Number.isInteger(data.seconds) && data.seconds >= 0 && data.seconds <= 31536000))) {
    throw new Error('Invalid puzzle attempt');
  }
  return { version: data.version, game: data.game, date: data.date, mode: data.mode, status: data.status, seconds: data.seconds };
}

// Upper edges (seconds) of the solve-time buckets kept per puzzle. Buckets let
// the site estimate a median time without reading individual players' records.
// Keep in sync with src/utils/difficulty.js (a test checks this).
export const TIME_BUCKETS = [30, 60, 120, 180, 300, 450, 600, 900, 1200, 1800, 2700, 3600];
export function timeBucket(seconds) {
  const index = TIME_BUCKETS.findIndex(edge => seconds <= edge);
  return `b${index === -1 ? TIME_BUCKETS.length : index}`;
}

export function transition(previous, input) {
  if (previous && previous.status !== 'started') return null;
  if (previous?.status === input.status) return null;
  const timedWin = input.status === 'won' && Number.isInteger(input.seconds);
  return {
    attempt: input, starts: previous ? 0 : 1, wins: input.status === 'won' ? 1 : 0, losses: input.status === 'lost' ? 1 : 0,
    // Only winning times count toward average/median solve time.
    timedWins: timedWin ? 1 : 0, winSeconds: timedWin ? input.seconds : 0, bucket: timedWin ? timeBucket(input.seconds) : null,
  };
}
