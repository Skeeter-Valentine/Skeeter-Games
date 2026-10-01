import { useDailyDate, useArchive } from '../../components/DailyBoundary';
import DailyResults from '../../components/DailyResults';
// src/games/word500/Word500.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Board, { getWord500Feedback } from './components/Board';
import Keyboard from './components/Keyboard';
import { getRandomTargetWord, getDailyTargetWord, isValidWord } from './constants/wordBank';
import './Word500.css';
import Navbar from '../../components/Navbar';

import { puzzleSnapshot } from '../../utils/archive.js';
import { readLocal, writeLocal } from '../../utils/dailyStats.js';

const MAX_ATTEMPTS = 8;

const DEFAULT_STATS = {
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
  lastPlayedDate: null
};

export default function Word500({ onWin }) {
  const [gameMode, setGameMode] = useState('daily');
  const [targetWord, setTargetWord] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState('');
  const [tileNotes, setTileNotes] = useState({});
  
  // Stats state
  const [stats, setStats] = useState(DEFAULT_STATS);

  // Hidden input ref for mobile virtual keyboard trigger
  const hiddenInputRef = useRef(null);

  const todayStr = useDailyDate();
  const archive = !!useArchive()?.archive;
  const progressKey = `${archive ? 'archive:v1:' : ''}skeedle500_daily_${todayStr}`;

  // Load stats from localStorage
  useEffect(() => {
    if (!archive) setStats(readLocal('skeedle500_stats', DEFAULT_STATS));
  }, [archive]);

  const initGame = useCallback((mode) => {
    setHasStarted(false);
    setCurrentGuess('');
    setMessage('');
    setTileNotes({});

    if (mode === 'daily') {
      const dailyWord = puzzleSnapshot('word500', todayStr, () => getDailyTargetWord(todayStr));
      setTargetWord(dailyWord);

      const saved = readLocal(progressKey, null);
      if (Array.isArray(saved?.savedGuesses) && saved.savedGuesses.length <= MAX_ATTEMPTS
        && saved.savedGuesses.every(word => typeof word === 'string' && /^[A-Z]{5}$/.test(word) && isValidWord(word))) {
        const { savedGuesses } = saved;
        const isFinished = savedGuesses.includes(dailyWord) || savedGuesses.length === MAX_ATTEMPTS;
        setHasStarted(savedGuesses.length > 0);
        setGuesses(savedGuesses);
        setGameOver(isFinished);
        if (isFinished) {
          const won = savedGuesses[savedGuesses.length - 1] === dailyWord;
          setMessage(won ? 'Daily Completed!' : `The word was ${dailyWord}`);
        }
      } else {
        setGuesses([]);
        setGameOver(false);
      }
    } else {
      setTargetWord(getRandomTargetWord());
      setGuesses([]);
      setGameOver(false);
    }
  }, [todayStr, progressKey]);

  const handleTileClick = (rowIndex, tileIndex) => {
    if (!gameOver) setHasStarted(true);
    const key = `${rowIndex}-${tileIndex}`;
    const currentColor = tileNotes[key] || 'none';
    
    const colorCycle = {
      none: 'green',
      green: 'yellow',
      yellow: 'pink',
      pink: 'none'
    };

    setTileNotes((prev) => ({
      ...prev,
      [key]: colorCycle[currentColor]
    }));
  };

  const handleResetNotes = () => {
    setTileNotes({});
  };

  const handleBoardClick = () => {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  };

  useEffect(() => {
    initGame(gameMode);
  }, [gameMode, initGame]);

  const handleKeyPress = useCallback(
    (key) => {
      if (gameOver) return;

      const upperKey = key.toUpperCase();

      if (upperKey === 'BACKSPACE' || upperKey === 'DELETE') {
        setCurrentGuess((prev) => prev.slice(0, -1));
        setMessage('');
      } else if (upperKey === 'ENTER') {
        if (currentGuess.length !== 5) {
          setMessage('Word must be 5 letters');
          return;
        }

        if (!isValidWord(currentGuess)) {
          setMessage('Not in word list');
          return;
        }

        const updatedGuesses = [...guesses, currentGuess];
        setGuesses(updatedGuesses);
        setCurrentGuess('');
        setMessage('');

        const isWin = currentGuess === targetWord;
        const isLoss = updatedGuesses.length >= MAX_ATTEMPTS;

        if (isWin) {
          onWin?.();
        }

        if (isWin || isLoss) {
          setGameOver(true);
          setMessage(isWin ? 'Great job!' : `Game Over! The word was ${targetWord}`);


        }

        if (gameMode === 'daily') {
          writeLocal(progressKey, { savedGuesses: updatedGuesses, isFinished: isWin || isLoss });
        }
      } else if (currentGuess.length < 5 && /^[A-Z]$/.test(upperKey)) {
        setHasStarted(true);
        setCurrentGuess((prev) => prev + upperKey);
        setMessage('');
      }
    },
    [currentGuess, gameOver, guesses, targetWord, gameMode, todayStr, progressKey, onWin]
  );

  // Desktop physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      
      // Ignore key events if the hidden input is focused to prevent duplication with mobile input
      if (document.activeElement === hiddenInputRef.current) return;

      if (e.key === 'Backspace' || e.key === 'Enter' || /^[a-zA-Z]$/.test(e.key)) {
        handleKeyPress(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress]);

  useEffect(() => {
    const gtagScript = document.createElement('script');
    gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-9TBQNYQE6V';
    gtagScript.async = true;
    document.head.appendChild(gtagScript);

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    gtag('js', new Date());
    gtag('config', 'G-9TBQNYQE6V');

    return () => {
      document.head.removeChild(gtagScript);
    };
  }, []);

  const guessedLetters = Array.from(
    new Set(guesses.join('').toUpperCase().split(''))
  );

  const confirmedPinkLetters = new Set();
  guesses.forEach((g) => {
    const { pink } = getWord500Feedback(g, targetWord);
    if (pink === 5) {
      g.toUpperCase().split('').forEach((letter) => confirmedPinkLetters.add(letter));
    }
  });

  return (
    <div className="word500-container">
      <Navbar />
      <DailyResults started={hasStarted} gameId="word500" title="Skeedle500" daily={gameMode === 'daily'} date={todayStr} finished={gameOver} won={guesses.includes(targetWord)} ready={!!targetWord} legacyStats={archive ? undefined : stats} />
      
      {/* Hidden input to trigger mobile virtual keyboard cleanly */}
      <input
        ref={hiddenInputRef}
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          height: 0,
          width: 0,
          top: 0,
          left: 0
        }}
        onChange={(e) => {
          const value = e.target.value;
          if (value.length > 0) {
            const lastChar = value[value.length - 1];
            if (/^[a-zA-Z]$/.test(lastChar)) {
              handleKeyPress(lastChar);
            }
            e.target.value = '';
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Backspace' || e.key === 'Enter') {
            handleKeyPress(e.key);
            e.preventDefault();
            e.target.value = '';
          }
        }}
      />

      <div className="skeedle-header">
        <button 
          className="skeedle-title-btn" 
          onClick={handleResetNotes}
          title="Click to reset tile notes"
        >
          Skeedle500
        </button>

        <div className="header-actions">
          
          <div className="mode-toggle">
            <button
              className={`mode-btn ${gameMode === 'daily' ? 'active' : ''}`}
              onClick={() => setGameMode('daily')}
            >
              Daily
            </button>
            <button
              className={`mode-btn ${gameMode === 'practice' ? 'active' : ''}`}
              onClick={() => setGameMode('practice')}
            >
              Practice
            </button>
          </div>
        </div>
      </div>

      {gameMode === 'practice' && (
        <div className="practice-actions">
          <button className="new-game-btn" onClick={() => initGame('practice')}>
            Next Word
          </button>
        </div>
      )}

      {message && <div className="word500-toast">{message}</div>}

      <div onClick={handleBoardClick} style={{ cursor: 'pointer' }}>
        <Board
          guesses={guesses}
          currentGuess={currentGuess}
          maxAttempts={MAX_ATTEMPTS}
          targetWord={targetWord}
          tileNotes={tileNotes}
          onTileClick={handleTileClick}
          confirmedPinkLetters={confirmedPinkLetters}
        />
      </div>

      <Keyboard onKeyPress={handleKeyPress} guessedLetters={guessedLetters} />

      
    </div>
  );
}
