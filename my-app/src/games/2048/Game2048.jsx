// src/pages/Game2048.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from '../../components/Navbar';
import './Game2048.css';
import FeedbackForm from '../../components/Feedback';

const GRID_SIZE = 4;

/* ==========================================================================
   SEED & DAILY GENERATOR HELPERS
   ========================================================================== */

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getDailySeed(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function Game2048() {
  const todayStr = new Date().toISOString().split('T')[0];
  const nextId = useRef(1);

  const [gameMode, setGameMode] = useState('daily'); // 'daily', 'classic', or 'unlimited'
  const [unlimitedSeed, setUnlimitedSeed] = useState(() => Math.floor(Math.random() * 1000000));
  const [tiles, setTiles] = useState([]);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState([]);
  const [undoCount, setUndoCount] = useState(0);
  const [isTestMode, setIsTestMode] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [winTimeFormatted, setWinTimeFormatted] = useState('');
  
  // Timer states
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerIntervalRef = useRef(null);

  const lastMoveTimeRef = useRef(Date.now());
  const [slideSpeed, setSlideSpeed] = useState(120);
  const touchStartRef = useRef({ x: 0, y: 0 });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('2048-theme') || 'skeeter';
  });

  useEffect(() => {
    localStorage.setItem('2048-theme', theme);
  }, [theme]);

  const handleThemeToggle = () => {
    setTheme((prev) => (prev === 'skeeter' ? 'classic' : 'skeeter'));
  };

  const createTile = useCallback((r, c, value = 2) => ({
    id: nextId.current++,
    r,
    c,
    value,
    isMerged: false,
  }), []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = useCallback(() => {
    if (!isTimerRunning) {
      setIsTimerRunning(true);
      timerIntervalRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
  }, [isTimerRunning]);

  const stopTimer = useCallback(() => {
    setIsTimerRunning(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  // Initialize board for Daily Challenge, Unlimited Puzzles, or Classic Mode
  const initGame = useCallback(() => {
    stopTimer();
    setElapsedTime(0);
    setIsTestMode(false);
    setGameWon(false);
    setWinTimeFormatted('');

    // 1. Purge old daily challenge keys from localStorage to prevent data leaks
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('2048-daily-') && key !== `2048-daily-${todayStr}`) {
        localStorage.removeItem(key);
      }
    });

    // 2. Restore today's daily challenge state if it exists
    if (gameMode === 'daily') {
      const saved = localStorage.getItem(`2048-daily-${todayStr}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setTiles(parsed.tiles);
          setScore(parsed.score);
          setHistory(parsed.history || []);
          setUndoCount(parsed.undoCount || 0);
          setGameWon(parsed.gameWon || false);
          return;
        } catch (e) {
          // Clear corrupted storage if JSON parse fails
          localStorage.removeItem(`2048-daily-${todayStr}`);
        }
      }
    }

    setScore(0);
    setHistory([]);
    setUndoCount(0);

    if (gameMode === 'daily' || gameMode === 'unlimited') {
      const currentSeed =
        gameMode === 'daily'
          ? getDailySeed(todayStr + '-2048')
          : getDailySeed(unlimitedSeed.toString() + '-unlimited-2048');

      const rng = mulberry32(currentSeed);

      // Total tiles for puzzle layout: between 8 and 10
      const totalTilesCount = 8 + Math.floor(rng() * 3);

      const allPositions = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          allPositions.push({ r, c });
        }
      }

      // Shuffle positions using the PRNG
      for (let i = allPositions.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
      }

      const highTierValues = [256, 512, 1024];
      const midTierValues = [32, 64, 128];
      const lowTierValues = [2, 4, 8, 16];

      const assignedValues = [];

      // 1. Guarantee at least 1 high-tier tile
      assignedValues.push(highTierValues[Math.floor(rng() * highTierValues.length)]);

      // 2. Guarantee at least 3 mid-tier tiles
      for (let i = 0; i < 3; i++) {
        assignedValues.push(midTierValues[Math.floor(rng() * midTierValues.length)]);
      }

      // 3. Fill remaining positions
      while (assignedValues.length < totalTilesCount) {
        const roll = rng();
        if (roll < 0.6) {
          assignedValues.push(lowTierValues[Math.floor(rng() * lowTierValues.length)]);
        } else {
          assignedValues.push(midTierValues[Math.floor(rng() * midTierValues.length)]);
        }
      }

      // Shuffle values
      for (let i = assignedValues.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [assignedValues[i], assignedValues[j]] = [assignedValues[j], assignedValues[i]];
      }

      const initialTiles = [];
      let initialScore = 0;

      for (let i = 0; i < assignedValues.length; i++) {
        const pos = allPositions[i];
        const val = assignedValues[i];
        initialTiles.push(createTile(pos.r, pos.c, val));
        initialScore += val;
      }

      setTiles(initialTiles);
      setScore(initialScore);
    } else {
      // Classic Mode Generation (2 random tiles)
      const firstR = Math.floor(Math.random() * 4);
      const firstC = Math.floor(Math.random() * 4);
      const firstVal = Math.random() < 0.9 ? 2 : 4;
      const first = createTile(firstR, firstC, firstVal);

      let secondR, secondC;
      do {
        secondR = Math.floor(Math.random() * 4);
        secondC = Math.floor(Math.random() * 4);
      } while (secondR === firstR && secondC === firstC);

      const secondVal = Math.random() < 0.9 ? 2 : 4;
      const second = createTile(secondR, secondC, secondVal);

      setTiles([first, second]);
    }
  }, [gameMode, todayStr, unlimitedSeed, createTile, stopTimer]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // Persist daily challenge state
  useEffect(() => {
    if (gameMode === 'daily' && tiles.length > 0) {
      const dailyPayload = {
        tiles,
        score,
        history,
        undoCount,
        gameWon,
      };
      localStorage.setItem(`2048-daily-${todayStr}`, JSON.stringify(dailyPayload));
    }
  }, [tiles, score, history, undoCount, gameWon, gameMode, todayStr]);

  const handleUndo = () => {
    if (history.length === 0 || isTestMode) return;

    const previousState = history[history.length - 1];
    setTiles(previousState.tiles);
    setScore(previousState.score);
    setHistory((prevHistory) => prevHistory.slice(0, -1));
    setUndoCount((prev) => prev + 1);
  };

  const handleUndo5x = () => {
    if (history.length === 0 || isTestMode) return;

    const steps = Math.min(history.length, 5);
    const previousState = history[history.length - steps];
    setTiles(previousState.tiles);
    setScore(previousState.score);
    setHistory((prevHistory) => prevHistory.slice(0, -steps));
    setUndoCount((prev) => prev + 5);
  };

  const move = useCallback((direction) => {
    if (isTestMode) return;

    const now = Date.now();
    const timeSinceLastMove = now - lastMoveTimeRef.current;
    lastMoveTimeRef.current = now;

    const currentSpeed = Math.max(50, Math.min(120, timeSinceLastMove * 0.8));
    setSlideSpeed(currentSpeed);

    const grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    tiles.forEach((tile) => {
      grid[tile.r][tile.c] = { ...tile, isMerged: false };
    });

    let moved = false;
    let addedScore = 0;
    const updatedTiles = [];
    let hasReached2048 = false;

    const isVertical = direction === 'UP' || direction === 'DOWN';
    const isReverse = direction === 'RIGHT' || direction === 'DOWN';

    for (let i = 0; i < GRID_SIZE; i++) {
      let line = [];
      for (let j = 0; j < GRID_SIZE; j++) {
        const r = isVertical ? j : i;
        const c = isVertical ? i : j;
        if (grid[r][c]) line.push(grid[r][c]);
      }

      if (isReverse) line.reverse();

      let k = 0;
      let targetPos = 0;

      while (k < line.length) {
        const current = line[k];
        const next = line[k + 1];

        const actualIndex = isReverse ? GRID_SIZE - 1 - targetPos : targetPos;
        const targetR = isVertical ? actualIndex : i;
        const targetC = isVertical ? i : actualIndex;

        if (next && current.value === next.value) {
          const newValue = current.value * 2;
          addedScore += newValue;

          if (newValue >= 2048) {
            hasReached2048 = true;
          }

          if (current.r !== targetR || current.c !== targetC || next.r !== targetR || next.c !== targetC) {
            moved = true;
          }

          updatedTiles.push({
            id: current.id, // Re-use the existing ID to allow CSS sliding animations
            r: targetR,
            c: targetC,
            value: newValue,
            isMerged: true,
          });

          k += 2;
        } else {
          if (current.r !== targetR || current.c !== targetC) {
            moved = true;
          }

          updatedTiles.push({
            ...current,
            r: targetR,
            c: targetC,
            isMerged: false,
          });

          k += 1;
        }

        targetPos++;
      }
    }

    if (!moved) return;

    startTimer(); // Start the timer on the first valid move

    const occupied = new Set(updatedTiles.map((t) => `${t.r}-${t.c}`));
    const emptySpots = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (!occupied.has(`${r}-${c}`)) emptySpots.push({ r, c });
      }
    }

    if (emptySpots.length > 0) {
      const spot = emptySpots[Math.floor(Math.random() * emptySpots.length)];
      const spawnedVal = Math.random() < 0.9 ? 2 : 4;
      updatedTiles.push({
        id: nextId.current++,
        r: spot.r,
        c: spot.c,
        value: spawnedVal,
        isMerged: false,
      });
    }

    if (hasReached2048 && !gameWon) {
      setGameWon(true);
      stopTimer();
      setWinTimeFormatted(formatTime(elapsedTime));
    }

    setHistory((prev) => [...prev, { tiles, score }]);
    setScore((prev) => prev + addedScore);
    setTiles(updatedTiles);
  }, [tiles, score, isTestMode, gameWon, startTimer, stopTimer, elapsedTime]);

  // Touch Event Handlers for Mobile Swiping
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e) => {
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    const minSwipeDistance = 30;

    if (Math.abs(deltaX) > minSwipeDistance || Math.abs(deltaY) > minSwipeDistance) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) move('RIGHT');
        else move('LEFT');
      } else {
        if (deltaY > 0) move('DOWN');
        else move('UP');
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'ArrowLeft') move('LEFT');
      if (e.key === 'ArrowRight') move('RIGHT');
      if (e.key === 'ArrowUp') move('UP');
      if (e.key === 'ArrowDown') move('DOWN');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move]);

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

  // Console injection helpers
  useEffect(() => {
    window.injectTile = (r, c, value) => {
      setTiles((prevTiles) => [
        ...prevTiles.filter((t) => !(t.r === r && t.c === c)),
        { id: nextId.current++, r, c, value, isMerged: false },
      ]);
    };

    window.setCustomScore = (newScore) => {
      setScore(newScore);
    };

    window.setCustomUndos = (count) => {
      setUndoCount(count);
    };

    return () => {
      delete window.injectTile;
      delete window.setCustomScore;
      delete window.setCustomUndos;
    };
  }, []);

  return (
    <div className={`game2048-container theme-${theme}`}>
      <Navbar />

      <main className="game2048-main">
        <div className="game2048-header">
          <div className="game2048-header-top">
            <h1 className="game2048-title">2048</h1>

            <div className="game2048-stats">
              <div className="game2048-stat-box">
                <span className="stat-label">SCORE</span>
                <span className="stat-value">{score}</span>
              </div>

              <div className="game2048-stat-box">
                <span className="stat-label">TIME</span>
                <span className="stat-value">{formatTime(elapsedTime)}</span>
              </div>

              <div className="game2048-stat-box">
                <span className="stat-label">UNDOS</span>
                <span className="stat-value undo-value">{undoCount}</span>
              </div>
            </div>
          </div>

          <div className="diff-toggle" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
            <button
              className={`diff-btn ${gameMode === 'daily' ? 'active' : ''}`}
              onClick={() => setGameMode('daily')}
            >
              Daily Challenge
            </button>
            <button
              className={`diff-btn ${gameMode === 'classic' ? 'blue' : ''}`}
              onClick={() => setGameMode('classic')}
            >
              Classic Mode
            </button>
            <button
              className={`diff-btn ${gameMode === 'unlimited' ? 'active' : ''}`}
              onClick={() => {
                setGameMode('unlimited');
                setUnlimitedSeed(Math.floor(Math.random() * 1000000));
              }}
            >
              Unlimited Puzzles
            </button>
          </div>

          <div className="game2048-controls-row">
            <div className="game2048-actions">
              <button
                className="game2048-btn undo-btn"
                onClick={handleUndo}
                disabled={history.length === 0 || isTestMode}
              >
                Undo
              </button>
              <button
                className="game2048-btn undo-btn"
                onClick={handleUndo5x}
                disabled={history.length === 0 || isTestMode}
              >
                Undo 5x
              </button>
              <button
                className="game2048-btn reset-btn"
                onClick={() => {
                  if (gameMode === 'daily') {
                    localStorage.removeItem(`2048-daily-${todayStr}`);
                  } else if (gameMode === 'unlimited') {
                    setUnlimitedSeed(Math.floor(Math.random() * 1000000));
                  }
                  initGame();
                }}
              >
                {gameMode === 'unlimited' ? 'New Puzzle' : 'Reset Board'}
              </button>
            </div>

            <div className="theme-switch-container">
              <span className="theme-label">Skeeter</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={theme === 'classic'}
                  onChange={handleThemeToggle}
                />
                <span className="slider round"></span>
              </label>
              <span className="theme-label">Classic</span>
            </div>
          </div>
        </div>

        {(gameMode === 'daily' || gameMode === 'unlimited') && !gameWon && (
          <div 
            className="game2048-banner" 
            style={{ 
              textAlign: 'center', 
              marginBottom: '12px', 
              fontSize: '1.15rem', 
              fontWeight: 'bold',
              backgroundColor: 'rgba(238, 228, 218, 0.5)',
              padding: '12px 16px',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
            }}
          >
            Can you reach 2048 from this precarious position?
          </div>
        )}

        {gameWon && (
          <div 
            className="game2048-banner win-banner" 
            style={{ 
              textAlign: 'center', 
              marginBottom: '12px', 
              fontSize: '1.15rem', 
              fontWeight: 'bold',
              backgroundColor: 'rgba(237, 194, 46, 0.25)',
              padding: '12px 16px',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
            }}
          >
            🎉 You reached 2048 in {winTimeFormatted || formatTime(elapsedTime)}!
          </div>
        )}

        <div
          className="game2048-board"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="game2048-grid-background">
            {Array(16)
              .fill(null)
              .map((_, i) => (
                <div key={i} className="game2048-cell" />
              ))}
          </div>

          <div className="game2048-tiles-layer">
            {tiles.map((tile) => {
              const digitsCount = tile.value.toString().length;
              const digitsClass = `digits-${digitsCount}`;

              return (
                <div
                  key={tile.id}
                  className={`game2048-tile tile-${tile.value} ${
                    tile.isMerged ? 'merged' : ''
                  } ${digitsClass}`}
                  style={{
                    '--r': tile.r,
                    '--c': tile.c,
                  }}
                >
                  {(tile.value === 131072 || tile.value === 131000) && theme === 'skeeter'
                    ? '🐐'
                    : tile.value}
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <FeedbackForm />
    </div>
  );
}

/*
window.injectTile(0,0,131072)
window.injectTile(0,1,16384)
window.injectTile(0,2,4096)
window.injectTile(0,3,1024)
window.setCustomScore(2207276)
window.setCustomUndos(532)
*/