import React from 'react';

const WORD_LENGTH = 5;
const MAX_ATTEMPTS = 9;

export default function Board({ targetWord, guesses, currentGuess, isGameOver, isInvalid }) {
  const solvedIndex = guesses.findIndex((g) => g === targetWord);
  const isSolved = solvedIndex !== -1;
  const visibleGuesses = isSolved ? guesses.slice(0, solvedIndex + 1) : guesses;

  const rows = [];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (i < visibleGuesses.length) {
      rows.push(
        <Row key={i} guess={visibleGuesses[i]} targetWord={targetWord} isSubmitted={true} />
      );
    } else if (i === visibleGuesses.length && !isSolved && !isGameOver) {
      rows.push(
        <Row
          key={i}
          guess={currentGuess}
          targetWord={targetWord}
          isSubmitted={false}
          isInvalid={isInvalid && currentGuess.length === WORD_LENGTH}
        />
      );
    } else {
      rows.push(<Row key={i} guess="" targetWord={targetWord} isSubmitted={false} />);
    }
  }

  return <div className={`board ${isSolved ? 'solved' : ''}`}>{rows}</div>;
}

function Row({ guess, targetWord, isSubmitted, isInvalid }) {
  const WORD_LENGTH = 5;
  const statuses = Array(WORD_LENGTH).fill('');

  if (isSubmitted && guess) {
    // Convert target word into an array of letters so we can "consume" matched letters
    const targetLetters = targetWord.split('');

    // PASS 1: Find all exact position matches ('correct')
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (guess[i] === targetLetters[i]) {
        statuses[i] = 'correct';
        targetLetters[i] = null; // Mark letter as used so it can't be matched again
      }
    }

    // PASS 2: Find misplaced letters ('present') or wrong letters ('absent')
    for (let i = 0; i < WORD_LENGTH; i++) {
      // Skip letters already solved in Pass 1
      if (statuses[i] === 'correct') continue;

      const char = guess[i];
      const foundIndex = targetLetters.indexOf(char);

      if (foundIndex !== -1) {
        statuses[i] = 'present';
        targetLetters[foundIndex] = null; // Mark letter as used
      } else {
        statuses[i] = 'absent';
      }
    }
  }

  // Render tiles using calculated statuses
  const tiles = [];
  for (let i = 0; i < WORD_LENGTH; i++) {
    const char = guess[i] || '';
    const status = statuses[i];

    tiles.push(
      <div key={i} className={`tile ${status} ${isInvalid ? 'invalid' : ''}`}>
        {char}
      </div>
    );
  }

  return <div className={`row ${isInvalid ? 'shake' : ''}`}>{tiles}</div>;
}