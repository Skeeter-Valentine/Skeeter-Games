export const games = ['map', '2048', 'akari', 'hashi', 'minesweeper', 'nonograms', 'parshle', 'pipes', 'quordle', 'shikaku', 'skeedle-marathon', 'skeedlemath', 'stitches', 'sudoku', 'word500'];

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

export function transition(previous, input) {
  if (previous && previous.status !== 'started') return null;
  if (previous?.status === input.status) return null;
  return { attempt: input, starts: previous ? 0 : 1, wins: input.status === 'won' ? 1 : 0, losses: input.status === 'lost' ? 1 : 0 };
}
