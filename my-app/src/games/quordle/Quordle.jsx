import React, { useState, useEffect } from 'react';
import Board from './components/Board';
import Keyboard from './components/Keyboard';
import { getRandomTargetWords, isValidWord } from './constants/wordBank';
import './Quordle.css';

const WORD_LENGTH = 5;
const MAX_ATTEMPTS = 9;

export default function App() {
  const [targetWords, setTargetWords] = useState([]);
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [isInvalidGuess, setIsInvalidGuess] = useState(false);

  useEffect(() => {
    startNewGame();
  }, []);

  const startNewGame = () => {
    setTargetWords(getRandomTargetWords(4));
    setGuesses([]);
    setCurrentGuess('');
    setGameOver(false);
    setIsInvalidGuess(false);
  };

  const handleInput = (key) => {
    if (gameOver || targetWords.length === 0) return;

    if (key === 'ENTER') {
      if (currentGuess.length === WORD_LENGTH) {
        submitGuess();
      }
    } else if (key === 'BACKSPACE' || key === 'DELETE') {
      setIsInvalidGuess(false);
      setCurrentGuess((prev) => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key)) {
      if (currentGuess.length < WORD_LENGTH) {
        const nextGuess = currentGuess + key;
        setCurrentGuess(nextGuess);

        if (nextGuess.length === WORD_LENGTH && !isValidWord(nextGuess)) {
          setIsInvalidGuess(true);
        } else {
          setIsInvalidGuess(false);
        }
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      handleInput(e.key.toUpperCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGuess, gameOver, targetWords]);

  const submitGuess = () => {
    if (!isValidWord(currentGuess)) {
      setIsInvalidGuess(true);
      return;
    }

    const newGuesses = [...guesses, currentGuess];
    setGuesses(newGuesses);
    setCurrentGuess('');
    setIsInvalidGuess(false);

    const allGuessed = targetWords.every((target) =>
      newGuesses.includes(target)
    );

    if (allGuessed || newGuesses.length === MAX_ATTEMPTS) {
      setGameOver(true);
    }
  };

  const getLetterStatuses = () => {
    const statuses = {};
    const ALL_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    ALL_KEYS.forEach((char) => {
      statuses[char] = ['', '', '', ''];
    });

    guesses.forEach((guess) => {
      for (let i = 0; i < guess.length; i++) {
        const char = guess[i];

        targetWords.forEach((targetWord, boardIdx) => {
          let currentStatus = statuses[char][boardIdx];

          let newStatus = 'absent';
          if (targetWord[i] === char) {
            newStatus = 'correct';
          } else if (targetWord.includes(char)) {
            newStatus = 'present';
          }

          if (currentStatus === 'correct') return;
          if (currentStatus === 'present' && newStatus === 'absent') return;

          statuses[char][boardIdx] = newStatus;
        });
      }
    });

    return statuses;
  };

  return (
    <div className="game-container">
      <div className="header">
        <h1 className="game-title">SKE4DLE</h1>
        <div className="sub-header">
          <span>Attempts: {guesses.length}/{MAX_ATTEMPTS}</span>
          <button className="new-game-btn" onClick={startNewGame}>
            New Game
          </button>
        </div>
      </div>

      <div className="quordle-grid">
        {targetWords.map((target, boardIdx) => (
          <Board
            key={`${target}-${boardIdx}`}
            targetWord={target}
            guesses={guesses}
            currentGuess={currentGuess}
            isGameOver={gameOver}
            isInvalid={isInvalidGuess}
          />
        ))}
      </div>

      {gameOver && (
        <div className="game-over-msg">
          Answers: {targetWords.join(', ')}
        </div>
      )}

      <Keyboard
        onKeyPress={handleInput}
        letterStatuses={getLetterStatuses()}
      />
    </div>
  );
}