export function marathonProgress(answers, guesses, limit) {
  const remainingWords = new Set(answers.filter(answer => !guesses.includes(answer))).size;
  const remainingGuesses = Math.max(0, limit - guesses.length);
  return { remainingWords, remainingGuesses, lost: remainingWords > remainingGuesses };
}
