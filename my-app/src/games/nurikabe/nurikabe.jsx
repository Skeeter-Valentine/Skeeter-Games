import React, { useState, useEffect, useCallback } from 'react';
import './Nurikabe.css';

// --- Puzzle Generator Helper Functions ---

function getNeighbours(x, y) {
  return [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ];
}

function checkInBounds(grid, x, y) {
  return x >= 0 && y >= 0 && x < grid.length && y < grid[0].length;
}

function isPoolSafe(grid, row, col) {
  const n_rows = grid.length;
  const n_cols = grid[0].length;
  
  // Upper left pool
  if (row !== 0 && col !== 0) {
    if (grid[row - 1][col - 1] === -1 && grid[row][col - 1] === -1 && grid[row - 1][col] === -1) {
      return false;
    }
  }
  // Lower left pool
  if (row !== n_rows - 1 && col !== 0) {
    if (grid[row + 1][col - 1] === -1 && grid[row][col - 1] === -1 && grid[row + 1][col] === -1) {
      return false;
    }
  }
  // Upper right pool
  if (row !== 0 && col !== n_cols - 1) {
    if (grid[row - 1][col] === -1 && grid[row - 1][col + 1] === -1 && grid[row][col + 1] === -1) {
      return false;
    }
  }
  // Lower right pool
  if (row !== n_rows - 1 && col !== n_cols - 1) {
    if (grid[row + 1][col] === -1 && grid[row][col + 1] === -1 && grid[row + 1][col + 1] === -1) {
      return false;
    }
  }
  return true;
}

function generateNurikabePuzzle(size) {
  let maxItters = 10;
  const maxIslandSize = Math.max(size, size) - 2;

  while (maxItters > 0) {
    const grid = Array(size).fill(0).map(() => Array(size).fill(0));
    
    // Pick a random seed cell for water (-1)
    const seed_row = Math.floor(Math.random() * size);
    const seed_col = Math.floor(Math.random() * size);

    const landOrWater = () => (Math.random() < 0.33 ? 0 : -1);

    const assignCell = (r, c, status) => {
      grid[r][c] = status;
      if (status === -1) {
        const neighbors = getNeighbours(r, c).sort(() => Math.random() - 0.5);
        for (const [nr, nc] of neighbors) {
          if (checkInBounds(grid, nr, nc) && grid[nr][nc] === 0) {
            if (!isPoolSafe(grid, nr, nc)) {
              grid[nr][nc] = 1; // land
            } else {
              assignCell(nr, nc, landOrWater());
            }
          }
        }
      }
    };

    assignCell(seed_row, seed_col, -1);

    // Fill remaining empty cells as land (1)
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (grid[i][j] === 0) {
          grid[i][j] = 1;
        }
      }
    }

    // Mark islands using flood fill
    const islandGrid = Array(size).fill(0).map(() => Array(size).fill(-1));
    let islandId = 0;

    const markIsland = (r, c, id) => {
      islandGrid[r][c] = id;
      for (const [nr, nc] of getNeighbours(r, c)) {
        if (checkInBounds(grid, nr, nc) && grid[nr][nc] === 1 && islandGrid[nr][nc] === -1) {
          markIsland(nr, nc, id);
        }
      }
    };

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (grid[i][j] === 1 && islandGrid[i][j] === -1) {
          markIsland(i, j, islandId);
          islandId++;
        }
      }
    }

    const nIslands = islandId;
    const sizes = Array(nIslands).fill(0);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (grid[i][j] === 1 && islandGrid[i][j] !== -1) {
          sizes[islandGrid[i][j]]++;
        }
      }
    }

    // Find the largest island
    let idLargest = 0;
    for (let i = 0; i < nIslands; i++) {
      if (sizes[i] > sizes[idLargest]) {
        idLargest = i;
      }
    }

    // Accept puzzle if largest island size is within limits, or max iterations reached
    if (sizes[idLargest] <= Math.max(2, maxIslandSize) || maxItters === 1) {
      const puzzleClues = [];
      for (let k = 0; k < nIslands; k++) {
        const islandCells = [];
        for (let i = 0; i < size; i++) {
          for (let j = 0; j < size; j++) {
            if (islandGrid[i][j] === k) {
              islandCells.push([i, j]);
            }
          }
        }
        if (islandCells.length > 0) {
          const hintCell = islandCells[Math.floor(Math.random() * islandCells.length)];
          puzzleClues.push({ r: hintCell[0], c: hintCell[1], val: sizes[k] });
        }
      }
      return puzzleClues;
    }

    maxItters--;
  }

  // Fallback simple puzzle
  return [{ r: 0, c: 0, val: size * size > 25 ? 4 : 2 }];
}

// --- Main Component ---

export default function Nurikabe() {
  const [boardSize, setBoardSize] = useState(5);
  const [puzzle, setPuzzle] = useState(() => generateNurikabePuzzle(5));
  const [board, setBoard] = useState([]);
  const [message, setMessage] = useState('');

  const initBoard = useCallback((currentPuzzle, size) => {
    const grid = Array(size).fill(null).map(() => Array(size).fill('empty'));
    currentPuzzle.forEach(p => {
      grid[p.r][p.c] = 'island';
    });
    return grid;
  }, []);

  useEffect(() => {
    const newPuz = generateNurikabePuzzle(boardSize);
    setPuzzle(newPuz);
    setBoard(initBoard(newPuz, boardSize));
    setMessage('');
  }, [boardSize, initBoard]);

  const isClue = (r, c) => puzzle.some(p => p.r === r && p.c === c);

  const getClueValue = (r, c) => {
    const found = puzzle.find(p => p.r === r && p.c === c);
    return found ? found.val : null;
  };

  const handleLeftClick = (r, c) => {
    if (isClue(r, c)) return;
    setBoard(prevBoard => {
      const newBoard = prevBoard.map(row => [...row]);
      newBoard[r][c] = newBoard[r][c] === 'wall' ? 'empty' : 'wall';
      return newBoard;
    });
    setMessage('');
  };

  const handleRightClick = (e, r, c) => {
    e.preventDefault();
    if (isClue(r, c)) return;
    setBoard(prevBoard => {
      const newBoard = prevBoard.map(row => [...row]);
      newBoard[r][c] = newBoard[r][c] === 'island' ? 'empty' : 'island';
      return newBoard;
    });
    setMessage('');
  };

  const handleNewPuzzle = () => {
    const newPuz = generateNurikabePuzzle(boardSize);
    setPuzzle(newPuz);
    setBoard(initBoard(newPuz, boardSize));
    setMessage('✨ New puzzle generated!');
  };

  const handleReset = () => {
    setBoard(initBoard(puzzle, boardSize));
    setMessage('Board reset.');
  };

  const handleCheckSolution = () => {
    let has2x2Wall = false;
    for (let r = 0; r < boardSize - 1; r++) {
      for (let c = 0; c < boardSize - 1; c++) {
        if (
          board[r]?.[c] === 'wall' &&
          board[r + 1]?.[c] === 'wall' &&
          board[r]?.[c + 1] === 'wall' &&
          board[r + 1]?.[c + 1] === 'wall'
        ) {
          has2x2Wall = true;
        }
      }
    }

    if (has2x2Wall) {
      setMessage('❌ Invalid: Walls cannot form 2x2 blocks!');
    } else {
      setMessage('👍 Looking good so far! Keep going.');
    }
  };

  const cellSize = boardSize === 10 ? '36px' : boardSize === 7 ? '42px' : '50px';
  const fontSize = boardSize === 10 ? '0.9rem' : '1.2rem';

  return (
    <div className="nurikabe-container">
      <h2>Nurikabe Puzzle</h2>
      
      <div className="nurikabe-controls">
        <label>
          Size:{' '}
          <select
            value={boardSize}
            onChange={(e) => setBoardSize(Number(e.target.value))}
            className="nurikabe-select"
          >
            <option value={5}>5 x 5</option>
            <option value={7}>7 x 7</option>
            <option value={10}>10 x 10</option>
          </select>
        </label>
      </div>

      <p className="instructions">
        <b>Left-click</b> for Wall (Black) &bull; <b>Right-click</b> for Island (White).
      </p>

      <div 
        className="nurikabe-grid" 
        style={{
          gridTemplateColumns: `repeat(${boardSize}, ${cellSize})`,
          gridTemplateRows: `repeat(${boardSize}, ${cellSize})`
        }}
      >
        {board.map((row, r) => 
          row.map((cellState, c) => {
            const clueVal = getClueValue(r, c);
            const clueClass = isClue(r, c) ? 'clue-cell' : '';
            return (
              <div
                key={`${r}-${c}`}
                className={`nurikabe-cell ${cellState} ${clueClass}`}
                style={{ fontSize }}
                onClick={() => handleLeftClick(r, c)}
                onContextMenu={(e) => handleRightClick(e, r, c)}
              >
                {clueVal !== null ? clueVal : ''}
              </div>
            );
          })
        )}
      </div>

      <div className="nurikabe-actions">
        <button className="nurikabe-btn" onClick={handleNewPuzzle}>New Puzzle</button>
        <button className="nurikabe-btn" onClick={handleCheckSolution}>Check Rules</button>
        <button className="nurikabe-btn reset" onClick={handleReset}>Reset</button>
      </div>

      {message && <p className="nurikabe-message">{message}</p>}
    </div>
  );
}