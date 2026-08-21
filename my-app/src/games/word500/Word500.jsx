// src/games/word500/Word500.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Board from './components/Board';
import Keyboard from './components/Keyboard';
import StatsModal from './components/StatsModal';
import { getRandomTargetWord, getDailyTargetWord, isValidWord } from './constants/wordBank';
import './Word500.css';
import Navbar from '../../components/Navbar';

const MAX_ATTEMPTS = 8;

const DEFAULT_STATS = {
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
  lastPlayedDate: null
};

export default function Word500() {
  const [gameMode, setGameMode] = useState('daily');
  const [targetWord, setTargetWord] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState('');
  const [tileNotes, setTileNotes] = useState({});
  
  // Stats state
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // Load stats from localStorage
  useEffect(() => {
    const savedStats = localStorage.getItem('skeedle500_stats');
    if (savedStats) {
      setStats(JSON.parse(savedStats));
    }
  }, []);

  const updateStatsOnGameEnd = (isWin, attemptCount) => {
    setStats((prev) => {
      const isNewDay = prev.lastPlayedDate !== todayStr;
      if (!isNewDay) return prev; // Avoid duplicate recording for the same day

      const newPlayed = prev.played + 1;
      const newWins = isWin ? prev.wins + 1 : prev.wins;
      const newCurrentStreak = isWin ? prev.currentStreak + 1 : 0;
      const newMaxStreak = Math.max(prev.maxStreak, newCurrentStreak);

      const newDist = { ...prev.guessDistribution };
      if (isWin && attemptCount) {
        newDist[attemptCount] = (newDist[attemptCount] || 0) + 1;
      }

      const updated = {
        played: newPlayed,
        wins: newWins,
        currentStreak: newCurrentStreak,
        maxStreak: newMaxStreak,
        guessDistribution: newDist,
        lastPlayedDate: todayStr
      };

      localStorage.setItem('skeedle500_stats', JSON.stringify(updated));
      return updated;
    });
  };

  const initGame = useCallback((mode) => {
    setCurrentGuess('');
    setMessage('');
    setTileNotes({});

    if (mode === 'daily') {
      const dailyWord = getDailyTargetWord(todayStr);
      setTargetWord(dailyWord);

      const saved = localStorage.getItem(`skeedle500_daily_${todayStr}`);
      if (saved) {
        const { savedGuesses, isFinished } = JSON.parse(saved);
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
  }, [todayStr]);

  const handleTileClick = (rowIndex, tileIndex) => {
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

        if (isWin || isLoss) {
          setGameOver(true);
          setMessage(isWin ? 'Great job!' : `Game Over! The word was ${targetWord}`);

          if (gameMode === 'daily') {
            updateStatsOnGameEnd(isWin, updatedGuesses.length);
            setTimeout(() => setIsStatsOpen(true), 1200);
          }
        }

        if (gameMode === 'daily') {
          localStorage.setItem(
            `skeedle500_daily_${todayStr}`,
            JSON.stringify({
              savedGuesses: updatedGuesses,
              isFinished: isWin || isLoss,
            })
          );
        }
      } else if (currentGuess.length < 5 && /^[A-Z]$/.test(upperKey)) {
        setCurrentGuess((prev) => prev + upperKey);
        setMessage('');
      }
    },
    [currentGuess, gameOver, guesses, targetWord, gameMode, todayStr]
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      handleKeyPress(e.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress]);

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
    <div className="word500-container">
      <Navbar />
      <div className="skeedle-header">
        <button 
        className="skeedle-title-btn" 
        onClick={handleResetNotes}
        title="Click to reset tile notes"
      >
        Skeedle500
      </button>

        <div className="header-actions">
          <button 
            className="stats-btn" 
            onClick={() => setIsStatsOpen(true)}
            aria-label="Statistics"
          >
            STATS
          </button>
          
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

      <Board
        guesses={guesses}
        currentGuess={currentGuess}
        maxAttempts={MAX_ATTEMPTS}
        targetWord={targetWord}
        tileNotes={tileNotes}
        onTileClick={handleTileClick}
      />

      <Keyboard onKeyPress={handleKeyPress} />

      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        stats={stats}
      />
    </div>
  );
}