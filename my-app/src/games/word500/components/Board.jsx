// src/games/word500/components/Board.jsx
import React from 'react';

function getWord500Feedback(guess, target) {
  if (!guess || !target || guess.length !== 5) {
    return { green: 0, yellow: 0, pink: 5 };
  }

  let green = 0;
  let yellow = 0;

  const targetArr = target.toUpperCase().split('');
  const guessArr = guess.toUpperCase().split('');

  const targetUsed = Array(5).fill(false);
  const guessUsed = Array(5).fill(false);

  // 1. Exact matches (Green)
  for (let i = 0; i < 5; i++) {
    if (guessArr[i] === targetArr[i]) {
      green++;
      targetUsed[i] = true;
      guessUsed[i] = true;
    }
  }

  // 2. Wrong position matches (Yellow)
  for (let i = 0; i < 5; i++) {
    if (guessUsed[i]) continue;
    for (let j = 0; j < 5; j++) {
      if (!targetUsed[j] && guessArr[i] === targetArr[j]) {
        yellow++;
        targetUsed[j] = true;
        break;
      }
    }
  }

  // 3. Absent letters (Pink)
  const pink = 5 - green - yellow;

  return { green, yellow, pink };
}

export default function Board({ guesses, currentGuess, maxAttempts, targetWord }) {
  return (
    <div className="word500-board">
      {Array.from({ length: maxAttempts }).map((_, rowIndex) => {
        const guess = guesses[rowIndex] || (rowIndex === guesses.length ? currentGuess : '');
        const isSubmitted = rowIndex < guesses.length;
        const feedback = isSubmitted ? getWord500Feedback(guess, targetWord) : null;

        return (
          <div key={rowIndex} className="word500-row">
            {/* 5-Tile Word Input */}
            <div className="word500-tiles">
              {Array.from({ length: 5 }).map((_, tileIndex) => (
                <div key={tileIndex} className="word500-tile">
                  {guess[tileIndex] || ''}
                </div>
              ))}
            </div>

            {/* 3-Box Feedback Grid with Green, Yellow, and Pink */}
           <div className="word500-score-boxes">
                <div className={`score-box q-green ${isSubmitted ? 'active' : ''}`}>
                    {isSubmitted ? feedback.green : ''}
                </div>
                <div className={`score-box q-yellow ${isSubmitted ? 'active' : ''}`}>
                    {isSubmitted ? feedback.yellow : ''}
                </div>
                <div className={`score-box q-pink ${isSubmitted ? 'active' : ''}`}>
                    {isSubmitted ? feedback.pink : ''}
                </div>
                </div>
          </div>
        );
      })}
    </div>
  );
}