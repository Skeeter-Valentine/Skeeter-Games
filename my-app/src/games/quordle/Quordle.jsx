import React, { useState, useEffect, useRef } from 'react';
import Board from './components/Board';
import Keyboard from './components/Keyboard';
import { getDailyTargetWords, 
  getRandomTargetWords, 
  isValidWord,
  getLocalDateString 
} from './constants/wordBank';
import './Quordle.css';
import Navbar from '../../components/Navbar';

const WORD_LENGTH = 5;
const MAX_ATTEMPTS = 9;

export default function Quordle() {
  // Mode state: 'daily' (default) or 'practice'
  const [gameMode, setGameMode] = useState('daily');

  const [targetWords, setTargetWords] = useState([]);
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [isInvalidGuess, setIsInvalidGuess] = useState(false);

  // 1. REF FOR HIDDEN MOBILE INPUT
  const inputRef = useRef(null);

  // Helper function to focus the hidden input and open the mobile keyboard
  const focusHiddenInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Initialize or Reset Game based on selected mode
  const initGame = (mode) => {
    setCurrentGuess('');
    setIsInvalidGuess(false);

    if (mode === 'daily') {
      const todayStr = getLocalDateString();
      const todayKey = `quordle_daily_${todayStr}`;
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('quordle_daily_') && key !== todayKey) {
          localStorage.removeItem(key);
        }
      });

      const dailyWords = getDailyTargetWords(todayStr);
      setTargetWords(dailyWords);

      // Check if player has saved progress for today
      const saved = localStorage.getItem(todayKey);
      if (saved) {
        const { guesses: savedGuesses, gameOver: savedGameOver } = JSON.parse(saved);
        setGuesses(savedGuesses);
        setGameOver(savedGameOver);
      } else {
        setGuesses([]);
        setGameOver(false);
      }
    } else {
      // Practice Mode: Fresh random words
      setTargetWords(getRandomTargetWords(4));
      setGuesses([]);
      setGameOver(false);
    }
  };

  // 2. Initial Load & Visibility Change (Resets board automatically if day rolled over)
  useEffect(() => {
    initGame(gameMode);

    // Re-check date when user tabs back into the page
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && gameMode === 'daily') {
        initGame('daily');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [gameMode]);

  // 3. Auto-focus hidden input on initial mount so mobile keyboard opens
  useEffect(() => {
    focusHiddenInput();
  }, []);

  // Save Daily Progress cleanly under today's date key
  useEffect(() => {
    if (gameMode === 'daily') {
      const todayKey = `quordle_daily_${getLocalDateString()}`;
      
      // Only write to localStorage if user has made at least one guess
      if (guesses.length > 0) {
        localStorage.setItem(
          todayKey,
          JSON.stringify({ guesses, gameOver })
        );
      }
    }
  }, [guesses, gameOver, gameMode]);

  // Handle Input (from physical or virtual keyboard)
  const handleInput = (key) => {
    if (gameOver) return;

    const upperKey = key.toUpperCase();

    if (upperKey === 'ENTER') {
      submitGuess();
    } else if (upperKey === 'BACKSPACE' || upperKey === 'DELETE') {
      setCurrentGuess((prev) => prev.slice(0, -1));
      setIsInvalidGuess(false);
    } else if (/^[A-Z]$/.test(upperKey)) {
      if (currentGuess.length < WORD_LENGTH) {
        setCurrentGuess((prev) => prev + upperKey);
        setIsInvalidGuess(false);
      }
    }
  };

  // 4. HANDLE HIDDEN INPUT CHANGE FOR MOBILE KEYBOARD
  const handleInputChange = (e) => {
    const value = e.target.value;
    if (!value) return;

    const lastChar = value.slice(-1);
    handleInput(lastChar);

    // Reset input field after key press
    e.target.value = '';
  };

  // Submit Word Guess Logic
  const submitGuess = () => {
    if (currentGuess.length !== WORD_LENGTH) {
      setIsInvalidGuess(true);
      return;
    }

    if (!isValidWord(currentGuess)) {
      setIsInvalidGuess(true);
      return;
    }

    const newGuesses = [...guesses, currentGuess.toUpperCase()];
    setGuesses(newGuesses);
    setCurrentGuess('');

    // Check if all 4 target words have been guessed
    const solvedCount = targetWords.filter((target) =>
      newGuesses.includes(target)
    ).length;

    if (solvedCount === 4 || newGuesses.length >= MAX_ATTEMPTS) {
      setGameOver(true);
    }
  };

  // Global Physical Keyboard Event Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Allow standard input behavior or handle backspace/enter explicitly
      if (e.key === 'Backspace') {
        handleInput('BACKSPACE');
      } else if (e.key === 'Enter') {
        handleInput('ENTER');
      } else if (document.activeElement.tagName === 'BUTTON') {
        document.activeElement.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGuess, gameOver, targetWords]);

  // Calculates letter statuses across ALL 4 game boards for the keyboard
  const getLetterStatuses = () => {
    const statuses = {};

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let char of alphabet) {
      statuses[char] = ['empty', 'empty', 'empty', 'empty'];
    }

    targetWords.forEach((target, boardIdx) => {
      guesses.forEach((guess) => {
        for (let i = 0; i < WORD_LENGTH; i++) {
          const letter = guess[i];
          const currentStatus = statuses[letter][boardIdx];

          if (currentStatus === 'correct') continue;

          if (target[i] === letter) {
            statuses[letter][boardIdx] = 'correct';
          } else if (target.includes(letter)) {
            statuses[letter][boardIdx] = 'present';
          } else {
            statuses[letter][boardIdx] = 'absent';
          }
        }
      });
    });

    return statuses;
  };

  // Handler to switch between 'daily' and 'practice' modes
  const handleModeSwitch = (newMode) => {
    if (newMode === gameMode) return;
    setGameMode(newMode);
    initGame(newMode);
  };

  useEffect(() => {
      // 1. Create and inject the external gtag script
      const gtagScript = document.createElement('script');
      gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-9TBQNYQE6V';
      gtagScript.async = true;
      document.head.appendChild(gtagScript);
  
      // 2. Initialize dataLayer and gtag config
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        window.dataLayer.push(arguments);
      }
      gtag('js', new Date());
      gtag('config', 'G-9TBQNYQE6V');
  
      // Cleanup script on unmount
      return () => {
        document.head.removeChild(gtagScript);
      };
    }, []);

  return (
    <div className="game-container" onClick={focusHiddenInput}>
      <Navbar />

      {/* 5. HIDDEN INPUT ELEMENT FOR MOBILE VIRTUAL KEYBOARD */}
      <input
        ref={inputRef}
        type="text"
        className="hidden-keyboard-input"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        onChange={handleInputChange}
      />

      <header className="header">
        <h1 className="game-title">SKE4DLE</h1>

        {/* Mode Toggle Controls */}
        <div className="mode-toggle">
          <button
            className={`mode-btn ${gameMode === 'daily' ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleModeSwitch('daily');
            }}
          >
            Daily
          </button>
          <button
            className={`mode-btn ${gameMode === 'practice' ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleModeSwitch('practice');
            }}
          >
            Practice
          </button>
        </div>

        <div className="sub-header">
          <span>Attempts: {guesses.length}/{MAX_ATTEMPTS}</span>
          {gameMode === 'practice' ? (
            <button
              className="new-game-btn"
              onClick={(e) => {
                e.stopPropagation();
                e.currentTarget.blur();
                initGame('practice');
              }}
            >
              New Game
            </button>
          ) : (
            <span className="daily-badge">Daily Puzzle</span>
          )}
        </div>
      </header>

      {/* 2x2 Game Boards */}
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

      {/* On-screen Keyboard */}
      <Keyboard
        onKeyPress={handleInput}
        letterStatuses={getLetterStatuses()}
      />
    </div>
  );
}