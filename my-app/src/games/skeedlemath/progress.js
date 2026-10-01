// Daily and archive Skeedle+ progress: only submitted guesses are kept.
// Colours are recalculated on load, so saves stay small and cannot drift.
export const mathProgressKey = (date, archive) => `${archive ? 'archive:v1:' : ''}skeedlemath-daily-progress-v1-${date}`;

export function restoreMathGuesses(target, saved, maxAttempts) {
  if (!saved || saved.target !== target || !Array.isArray(saved.guesses)) return { guesses: [], status: 'IN_PROGRESS', hasStarted: false };
  const guesses = [];
  for (const guess of saved.guesses) {
    if (typeof guess !== 'string' || guess.length !== target.length) continue;
    guesses.push(guess);
    if (guess === target || guesses.length >= maxAttempts) break;
  }
  const status = guesses.includes(target) ? 'WON' : guesses.length >= maxAttempts ? 'LOST' : 'IN_PROGRESS';
  return { guesses, status, hasStarted: guesses.length > 0 || !!saved.hasStarted };
}
