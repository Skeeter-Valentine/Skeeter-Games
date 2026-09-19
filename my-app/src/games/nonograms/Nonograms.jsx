// src/games/nonograms/Nonograms.jsx
import React, { useState, useEffect, useCallback } from 'react';
import './Nonograms.css';
import Navbar from '../../components/Navbar';

// --- Random Puzzle Generator Helpers ---
function randomFromRange(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1) + min);
}

function generateRandomPuzzleGrid(rows, cols, rng = Math.random) {
  return Array.from({ length: rows }, () => {
    let cells = [];
    let num = randomFromRange(1, cols, rng);
    let value = randomFromRange(0, 1, rng);
    while (cells.length < cols) {
      cells.push(...new Array(Math.min(num, cols - cells.length)).fill(value));
      value = 1 - value;
      num = randomFromRange(1, cols - cells.length, rng);
    }
    return cells;
  });
}

// Simple seeded PRNG (LCG) for daily puzzles based on date string (YYYY-MM-DD)
function getDailyRng(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  let seed = Math.abs(hash);
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Helper to generate row and column clues
const generateClues = (grid) => {
  const height = grid.length;
  const width = grid[0].length;

  const rowClues = grid.map(row => {
    const clues = [];
    let count = 0;
    for (let cell of row) {
      if (cell === 1) count++;
      else if (count > 0) { clues.push(count); count = 0; }
    }
    if (count > 0) clues.push(count);
    return clues.length ? clues : [0];
  });

  const colClues = [];
  for (let c = 0; c < width; c++) {
    const clues = [];
    let count = 0;
    for (let r = 0; r < height; r++) {
      if (grid[r][c] === 1) count++;
      else if (count > 0) { clues.push(count); count = 0; }
    }
    if (count > 0) clues.push(count);
    colClues.push(clues.length ? clues : [0]);
  }

  return { rowClues, colClues };
};

export default function Nonograms({ onWin }) {
  const [gameMode, setGameMode] = useState('daily'); // Start on daily mode by default
  const [selectedSize, setSelectedSize] = useState('5x5');

  const [rows, cols] = selectedSize.split('x').map(Number);

  // Generate initial Daily puzzle grid (10x10) based on today's date
  const [solutionGrid, setSolutionGrid] = useState(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return generateRandomPuzzleGrid(10, 10, getDailyRng(todayStr));
  });
  
  const height = solutionGrid.length;
  const width = solutionGrid[0].length;
  const { rowClues, colClues } = generateClues(solutionGrid);

  const [playerGrid, setPlayerGrid] = useState(
    Array.from({ length: height }, () => Array(width).fill(0))
  );
  
  const [currentTool, setCurrentTool] = useState(1); // 1 = fill, 2 = cross
  const [isWon, setIsWon] = useState(false);

  // Dragging states
  const [isDragging, setIsDragging] = useState(false);
  const [dragAction, setDragAction] = useState(null);

  // Global mouse up listener to stop dragging if mouse leaves window/grid
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setDragAction(null);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const loadDailyPuzzle = useCallback(() => {
    setGameMode('daily');
    const todayStr = new Date().toISOString().slice(0, 10);
    const dailyRng = getDailyRng(todayStr);
    const dailyPuzzle = generateRandomPuzzleGrid(10, 10, dailyRng);
    
    setSelectedSize('10x10');
    setSolutionGrid(dailyPuzzle);
    setPlayerGrid(Array.from({ length: 10 }, () => Array(10).fill(0)));
    setIsWon(false);
  }, []);

  const loadPracticeMode = useCallback(() => {
    setGameMode('practice');
    const [r, c] = selectedSize.split('x').map(Number);
    const practicePuzzle = generateRandomPuzzleGrid(r, c);
    setSolutionGrid(practicePuzzle);
    setPlayerGrid(Array.from({ length: r }, () => Array(c).fill(0)));
    setIsWon(false);
  }, [selectedSize]);

  // Handle board size change specifically in practice mode
  const handleSizeChange = (e) => {
    const size = e.target.value;
    setSelectedSize(size);
    const [r, c] = size.split('x').map(Number);
    const newPuzzle = generateRandomPuzzleGrid(r, c);
    setSolutionGrid(newPuzzle);
    setPlayerGrid(Array.from({ length: r }, () => Array(c).fill(0)));
    setIsWon(false);
  };

  const handleGenerateNewRandom = () => {
    const [r, c] = selectedSize.split('x').map(Number);
    const newPuzzle = generateRandomPuzzleGrid(r, c);
    setSolutionGrid(newPuzzle);
    setPlayerGrid(Array.from({ length: r }, () => Array(c).fill(0)));
    setIsWon(false);
  };

  const handleMouseDown = (e, r, c) => {
    if (isWon) return;
    e.preventDefault();

    let actionToApply;
    if (e.button === 2) {
      actionToApply = playerGrid[r][c] === 2 ? 0 : 2;
    } else {
      actionToApply = playerGrid[r][c] === currentTool ? 0 : currentTool;
    }

    setIsDragging(true);
    setDragAction(actionToApply);

    const newGrid = playerGrid.map(row => [...row]);
    newGrid[r][c] = actionToApply;
    setPlayerGrid(newGrid);
    checkWinCondition(newGrid);
  };

  const handleMouseEnter = (r, c) => {
    if (!isDragging || isWon || dragAction === null) return;

    const newGrid = playerGrid.map(row => [...row]);
    if (newGrid[r][c] !== dragAction) {
      newGrid[r][c] = dragAction;
      setPlayerGrid(newGrid);
      checkWinCondition(newGrid);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
  };

  const checkWinCondition = (gridToCheck) => {
    let won = true;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const target = solutionGrid[r][c] === 1 ? 1 : 0;
        const playerVal = gridToCheck[r][c] === 1 ? 1 : 0;
        if (target !== playerVal) {
          won = false;
          break;
        }
      }
      if (!won) break;
    }
    if (won && !isWon) {
      setIsWon(true);
      onWin?.();
    }
  };

  const resetBoard = () => {
    setPlayerGrid(Array.from({ length: height }, () => Array(width).fill(0)));
    setIsWon(false);
  };

  return (
    <>
      <Navbar />
      <div className="nonogram-wrapper">
        <h1 className="nonogram-title">SKEEDOGRAMS</h1>
        <p className="nonogram-subtitle">
          {gameMode === 'daily' ? "📅 Today's Daily 10x10 Puzzle" : "Practice Mode - Click and drag to solve!"}
        </p>

        {/* Top row: Mode Selection Buttons */}
        <div className="toolbar mode-toolbar">
          <button 
            className={`tool-btn mode-btn ${gameMode === 'daily' ? 'active' : ''}`} 
            onClick={loadDailyPuzzle}
          >
            🌟 Daily Challenge
          </button>
          <button 
            className={`tool-btn mode-btn ${gameMode === 'practice' ? 'active' : ''}`} 
            onClick={loadPracticeMode}
          >
            🛠️ Practice Mode
          </button>
        </div>

        {/* Sub-row: Board Size Dropdown (Visible ONLY in Practice Mode) */}
        {gameMode === 'practice' && (
          <div className="toolbar sub-toolbar">
            <select value={selectedSize} onChange={handleSizeChange} className="tool-select">
              <option value="5x5">5 x 5 Board</option>
              <option value="10x10">10 x 10 Board</option>
              <option value="15x15">15 x 15 Board</option>
            </select>
            <button className="tool-btn" onClick={handleGenerateNewRandom}>
              🎲 New Random
            </button>
          </div>
        )}

        {/* Game Tool Toolbar */}
        <div className="toolbar action-toolbar">
          <button 
            className={`tool-btn ${currentTool === 1 ? 'active' : ''}`} 
            onClick={() => setCurrentTool(1)}
          >
            ✏️ Fill
          </button>
          <button 
            className={`tool-btn ${currentTool === 2 ? 'active' : ''}`} 
            onClick={() => setCurrentTool(2)}
          >
            ❌ Cross
          </button>
          <button className="reset-btn" onClick={resetBoard}>Reset</button>
        </div>

        {isWon && <div className="victory-message">🎉 Puzzle Completed Successfully! 🎉</div>}

        <div className="puzzle-container" onContextMenu={handleContextMenu}>
          <div 
            className="grid-layout" 
            style={{ '--grid-cols': width }}
          >
            <div className="clue-cell corner"></div>

            {colClues.map((clues, cIdx) => (
              <div key={`col-${cIdx}`} className="clue-cell col-clue">
                {clues.map((val, i) => <span key={i}>{val}</span>)}
              </div>
            ))}

            {rowClues.map((clues, rIdx) => (
              <React.Fragment key={`row-${rIdx}`}>
                <div className="clue-cell row-clue">
                  {clues.join('\u00A0\u00A0')}
                </div>

                {playerGrid[rIdx].map((cellState, cIdx) => {
                  let className = 'game-cell';
                  if (cellState === 1) className += ' filled';
                  if (cellState === 2) className += ' crossed';

                  if ((cIdx + 1) % 5 === 0 && cIdx < width - 1) {
                    className += ' thick-right';
                  }
                  if ((rIdx + 1) % 5 === 0 && rIdx < height - 1) {
                    className += ' thick-bottom';
                  }

                  return (
                    <button
                      key={`cell-${rIdx}-${cIdx}`}
                      className={className}
                      onMouseDown={(e) => handleMouseDown(e, rIdx, cIdx)}
                      onMouseEnter={() => handleMouseEnter(rIdx, cIdx)}
                    >
                      {cellState === 2 ? '✕' : ''}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}