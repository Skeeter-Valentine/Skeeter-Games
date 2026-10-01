export function marathonProgress(answers, guesses, limit) {
  const remainingWords = new Set(answers.filter(answer => !guesses.includes(answer))).size;
  const remainingGuesses = Math.max(0, limit - guesses.length);
  return { remainingWords, remainingGuesses, lost: remainingWords > remainingGuesses };
}

// Daily and archive progress, tied to the exact 26 answers it was played with.
export const marathonProgressKey = (date, archive) => `${archive ? 'archive:v1:' : ''}skeedle-marathon-progress-v1-${date}`;

const whole = value => Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

export function saveMarathon(answers, { guesses, secondsElapsed, hasStarted, loss, continuePlaying }) {
  return { answers: answers.join(','), guesses, secondsElapsed, hasStarted, loss, continuePlaying };
}

export function restoreMarathon(answers, saved) {
  const fresh = { guesses: [], secondsElapsed: 0, hasStarted: false, loss: null, continuePlaying: false };
  if (!saved || saved.answers !== answers.join(',') || !Array.isArray(saved.guesses)) return fresh;
  const guesses = [...new Set(saved.guesses.filter(guess => typeof guess === 'string' && /^[A-Z]{5}$/.test(guess)))];
  const loss = saved.loss && Number.isFinite(saved.loss.remainingWords) && Number.isFinite(saved.loss.remainingGuesses)
    ? { remainingWords: whole(saved.loss.remainingWords), remainingGuesses: whole(saved.loss.remainingGuesses), lost: true, seconds: whole(saved.loss.seconds) }
    : null;
  return {
    guesses, secondsElapsed: whole(saved.secondsElapsed), hasStarted: guesses.length > 0 || !!saved.hasStarted,
    loss, continuePlaying: !!loss && !!saved.continuePlaying,
  };
}
