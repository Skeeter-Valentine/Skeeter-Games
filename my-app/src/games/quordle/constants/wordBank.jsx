import wordData from '../../../constants/words.json'

// Set lookups for O(1) performance
const ANSWERS_SET = new Set(wordData.answers);
const VALID_GUESSES_SET = new Set([
  ...wordData.answers,
  ...wordData.validGuesses
]);


// Helper 1: Mulberry32 PRNG (Deterministic Pseudo-Random Generator)
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Helper 2: Convert date string "YYYY-MM-DD" into a numeric seed
function getDateSeed(dateString) {
  let hash = 0;
  for (let i = 0; i < dateString.length; i++) {
    hash = (hash << 5) - hash + dateString.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * 1. DAILY MODE: Returns the exact same 4 words for a given date
 */
export function getDailyTargetWords(dateOverride = null) {
  // Get today's local date in YYYY-MM-DD format
  const todayStr = dateOverride || new Date().toISOString().split('T')[0];
  const seed = getDateSeed(todayStr);
  const random = mulberry32(seed);

  const wordList = [...wordData.answers];
  const selectedWords = [];

  // Pick 4 unique words deterministically
  while (selectedWords.length < 4 && wordList.length > 0) {
    const randomIndex = Math.floor(random() * wordList.length);
    const chosenWord = wordList[randomIndex].toUpperCase();

    selectedWords.push(chosenWord);
    wordList.splice(randomIndex, 1);
  }

  return selectedWords;
}

// Helper to get local date in "YYYY-MM-DD" format
export function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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