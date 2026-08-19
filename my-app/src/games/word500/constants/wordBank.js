import wordsData from '../../../constants/words.json'

const TARGET_WORDS = wordsData.answers.map((w) => w.toUpperCase());

// Combine validGuesses and answers so target words are also valid guesses
const ALL_VALID = [
  ...(wordsData.validGuesses || []),
  ...(wordsData.answers || [])
];

const VALID_DICTIONARY = new Set(ALL_VALID.map((w) => w.toUpperCase()));

export function getRandomTargetWord() {
  const randomIndex = Math.floor(Math.random() * TARGET_WORDS.length);
  return TARGET_WORDS[randomIndex];
}

export function getDailyTargetWord(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % TARGET_WORDS.length;
  return TARGET_WORDS[index];
}

export function isValidWord(word) {
  if (!word || word.length !== 5) return false;
  return VALID_DICTIONARY.has(word.toUpperCase());
}