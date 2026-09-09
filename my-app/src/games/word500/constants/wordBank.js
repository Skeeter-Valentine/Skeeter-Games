import wordsData from '../../../constants/words.json';

const TARGET_WORDS = wordsData.answers.map((w) => w.toUpperCase());

// Combine validGuesses and answers so target words are also valid guesses
const ALL_VALID = [
  ...(wordsData.validGuesses || []),
  ...(wordsData.answers || [])
];

const VALID_DICTIONARY = new Set(ALL_VALID.map((w) => w.toUpperCase()));

function mulberry32(seed) {
    return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

export function getRandomTargetWord() {
  const randomIndex = Math.floor(Math.random() * TARGET_WORDS.length);
  return TARGET_WORDS[randomIndex];
}

export function getDailyTargetWord(dateStr) {
  // Convert YYYY-MM-DD into a stable number seed (e.g., 2026-09-09 -> 20260909)
  const seedNum = parseInt(dateStr.replace(/-/g, ''), 10);
  const rng = mulberry32(seedNum);

  // Pick a pseudo-random index across the entire shuffled target words list
  const randomIndex = Math.floor(rng() * TARGET_WORDS.length);
  return TARGET_WORDS[randomIndex];
}

export function isValidWord(word) {
  if (!word || word.length !== 5) return false;
  return VALID_DICTIONARY.has(word.toUpperCase());
}