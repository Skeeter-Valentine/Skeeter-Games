// src/pages/Game2048.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from '../../components/Navbar';
import './Game2048.css';

const GRID_SIZE = 4;

export default function Game2048() {
  const nextId = useRef(1);
  const [tiles, setTiles] = useState([]);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState([]);
  const [undoCount, setUndoCount] = useState(0);
  const [isTestMode, setIsTestMode] = useState(false);

  const createTile = (r, c, value = Math.random() < 0.9 ? 2 : 4) => ({
    id: nextId.current++,
    r,
    c,
    value,
    isMerged: false,
  });

  const initGame = useCallback(() => {
    setIsTestMode(false);
    const first = createTile(Math.floor(Math.random() * 4), Math.floor(Math.random() * 4));
    let secondR, secondC;
    do {
      secondR = Math.floor(Math.random() * 4);
      secondC = Math.floor(Math.random() * 4);
    } while (secondR === first.r && secondC === first.c);

    const second = createTile(secondR, secondC);
    setTiles([first, second]);
    setScore(0);
    setHistory([]);
    setUndoCount(0);
  }, []);

  // Fills every tile position (0-15) with power-of-two values
  const enableTestState = () => {
    const testValues = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536];
    const testTiles = testValues.map((val, idx) => ({
      id: nextId.current++,
      r: Math.floor(idx / GRID_SIZE),
      c: idx % GRID_SIZE,
      value: val,
      isMerged: false,
    }));

    setTiles(testTiles);
    setIsTestMode(true);
  };

  useEffect(() => {
    initGame();
  }, [initGame]);

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
    if (isTestMode) return; // Freeze inputs while in test mode

    const grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    tiles.forEach((tile) => {
      grid[tile.r][tile.c] = { ...tile, isMerged: false };
    });

    let moved = false;
    let addedScore = 0;
    const updatedTiles = [];

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

      let mergedLine = [];
      let skipNext = false;

      for (let k = 0; k < line.length; k++) {
        if (skipNext) {
          skipNext = false;
          continue;
        }

        const current = line[k];
        const next = line[k + 1];

        if (next && current.value === next.value) {
          const newValue = current.value * 2;
          addedScore += newValue;

          mergedLine.push({ ...current, value: newValue, isMerged: true });
          skipNext = true;
          moved = true;
        } else {
          mergedLine.push({ ...current, isMerged: false });
        }
      }

      if (isReverse) mergedLine.reverse();

      mergedLine.forEach((tile, index) => {
        const targetIndex = isReverse ? GRID_SIZE - mergedLine.length + index : index;
        const newR = isVertical ? targetIndex : i;
        const newC = isVertical ? i : targetIndex;

        if (tile.r !== newR || tile.c !== newC) {
          moved = true;
        }

        updatedTiles.push({ ...tile, r: newR, c: newC });
      });
    }

    if (!moved) return;

    const occupied = new Set(updatedTiles.map((t) => `${t.r}-${t.c}`));
    const emptySpots = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (!occupied.has(`${r}-${c}`)) emptySpots.push({ r, c });
      }
    }

    if (emptySpots.length > 0) {
      const spot = emptySpots[Math.floor(Math.random() * emptySpots.length)];
      updatedTiles.push(createTile(spot.r, spot.c));
    }

    setHistory((prevHistory) => [
      ...prevHistory,
      { tiles, score },
    ]);

    setScore((prev) => prev + addedScore);
    setTiles(updatedTiles);
  }, [tiles, score, isTestMode]);

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

  return (
    <div className="game2048-container">
      <Navbar />

      <main className="game2048-main">
        <div className="game2048-header">
          <h1 className="game2048-title">2048</h1>

          <div className="game2048-stats">
            <div className="game2048-stat-box">
              <span className="stat-label">SCORE</span>
              <span className="stat-value">{score}</span>
            </div>

            <div className="game2048-stat-box">
              <span className="stat-label">UNDOS</span>
              <span className="stat-value undo-value">{undoCount}</span>
            </div>
          </div>

          <div className="game2048-actions">
            <button 
              className={`game2048-btn test-btn ${isTestMode ? 'active' : ''}`}
              onClick={isTestMode ? initGame : enableTestState}
            >
              {isTestMode ? 'Exit Test' : 'Test Grid'}
            </button>
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
            <button className="game2048-btn reset-btn" onClick={initGame}>
              New Game
            </button>
          </div>
        </div>

        <div className="game2048-board">
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
                  className={`game2048-tile tile-${tile.value} ${tile.isMerged ? 'merged' : ''} ${digitsClass}`}
                  style={{
                    '--r': tile.r,
                    '--c': tile.c,
                  }}
                >
                  {tile.value}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}