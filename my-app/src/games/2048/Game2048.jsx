// src/pages/Game2048.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from '../../components/Navbar';
import './Game2048.css';

const GRID_SIZE = 4;

export default function Game2048() {
  const nextId = useRef(1);
  const [tiles, setTiles] = useState([]);
  const [score, setScore] = useState(0);

  const createTile = (r, c, value = Math.random() < 0.9 ? 2 : 4) => ({
    id: nextId.current++,
    r,
    c,
    value,
  });

  const initGame = useCallback(() => {
    const first = createTile(Math.floor(Math.random() * 4), Math.floor(Math.random() * 4));
    let secondR, secondC;
    do {
      secondR = Math.floor(Math.random() * 4);
      secondC = Math.floor(Math.random() * 4);
    } while (secondR === first.r && secondC === first.c);

    const second = createTile(secondR, secondC);
    setTiles([first, second]);
    setScore(0);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const move = useCallback((direction) => {
    setTiles((prevTiles) => {
      const grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
      prevTiles.forEach((tile) => {
        grid[tile.r][tile.c] = { ...tile };
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

            mergedLine.push({ ...current, value: newValue });
            skipNext = true;
            moved = true;
          } else {
            mergedLine.push(current);
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

      if (!moved) return prevTiles;

      setScore((prev) => prev + addedScore);

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

      return updatedTiles;
    });
  }, []);

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
          <div className="game2048-score-box">
            <span className="score-label">SCORE</span>
            <span className="score-value">{score}</span>
          </div>
          <button className="game2048-reset-btn" onClick={initGame}>
            New Game
          </button>
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
            {tiles.map((tile) => (
              <div
                key={tile.id}
                className={`game2048-tile tile-${tile.value}`}
                style={{
                  '--r': tile.r,
                  '--c': tile.c,
                }}
              >
                {tile.value}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}