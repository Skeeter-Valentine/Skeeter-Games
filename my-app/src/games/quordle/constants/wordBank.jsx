import wordData from './words.json';

// Set lookups for O(1) performance
const ANSWERS_SET = new Set(wordData.answers);
const VALID_GUESSES_SET = new Set([
  ...wordData.answers,
  ...wordData.validGuesses
]);

/**
 * Gets 'count' unique random target words from the answer bank.
 */
export const getRandomTargetWords = (count = 4) => {
  const shuffled = [...wordData.answers].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

/**
 * Checks if a word is in either the valid guesses or answer list.
 */
export const isValidWord = (word) => {
  if (!word || word.length !== 5) return false;
  return VALID_GUESSES_SET.has(word.toUpperCase());
};