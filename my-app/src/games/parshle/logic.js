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
  let state = 2166136261;
  for (const char of `${seed}:${row}`) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  const positions = [0, 1, 2, 3, 4];
  for (let i = 4; i > 0; i--) {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const j = Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(0, 2);
}

export function visibleFeedback(guess, answer, seed, row) {
  const hidden = hiddenPositions(seed, row);
  return feedback(guess, answer).map((color, i) => hidden.includes(i) ? 'hidden' : color);
}

export function keyboardFeedback(guesses, answer, seed) {
  const keys = {};
  const rank = { absent: 1, present: 2, correct: 3 };
  guesses.forEach((guess, row) => visibleFeedback(guess, answer, seed, row).forEach((color, i) => {
    if (color !== 'hidden' && (rank[color] > (rank[keys[guess[i]]] || 0))) keys[guess[i]] = color;
  }));
  return keys;
}
