import { scheduledDifficulty } from '../../utils/dailySchedule.js';

export function feedback(guess, answer) {
  const colors = Array(5).fill('absent');
  const remaining = {};
  [...answer].forEach((letter, i) => {
    if (guess[i] === letter) colors[i] = 'correct';
    else remaining[letter] = (remaining[letter] || 0) + 1;
  });
  [...guess].forEach((letter, i) => {
    if (colors[i] !== 'correct' && remaining[letter] > 0) {
      colors[i] = 'present';
      remaining[letter]--;
    }
  });
  return colors;
}

export function hiddenPositions(seed, row) {
  if (row < 0 || row >= 5) return [];
  let state = 2166136261;
  for (const char of `${seed}:board`) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const daily = /^parshle:(\d{4}-\d{2}-\d{2})$/.exec(seed);
  const [minimum, count] = daily
    ? [[5, 3], [8, 2], [10, 3]][scheduledDifficulty('parshle', daily[1]) - 1]
    : [5, 8];
  const total = minimum + Math.floor(random() * count);
  const positions = Array.from({ length: 25 }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  const hidden = positions.slice(0, total);
  const counts = Array(5).fill(0);
  hidden.forEach(position => counts[Math.floor(position / 5)]++);
  // Avoid boards with the same hidden count in all five rows.
  if (counts.every(count => count === counts[0])) {
    const lastRow = Math.floor(hidden[total - 1] / 5);
    hidden[total - 1] = positions.slice(total).find(position => Math.floor(position / 5) !== lastRow);
  }
  return hidden.filter(position => Math.floor(position / 5) === row).map(position => position % 5);
}

export function visibleFeedback(guess, answer, seed, row, masks) {
  const hidden = masks?.[row] ?? hiddenPositions(seed, row);
  return feedback(guess, answer).map((color, i) => hidden.includes(i) ? 'hidden' : color);
}

export function keyboardFeedback(guesses, answer, seed, masks) {
  const keys = {};
  const rank = { absent: 1, present: 2, correct: 3 };
  guesses.forEach((guess, row) => visibleFeedback(guess, answer, seed, row, masks).forEach((color, i) => {
    if (color !== 'hidden' && (rank[color] > (rank[keys[guess[i]]] || 0))) keys[guess[i]] = color;
  }));
  return keys;
}
