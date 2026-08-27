import React, { useState, useEffect, useRef, useCallback } from 'react';
import './pipes.css';
import Navbar from '../../components/Navbar';
import FeedbackForm from '../../components/Feedback';

/* ==========================================================================
   1. SEEDED PSEUDO-RANDOM NUMBER GENERATOR (For Daily Puzzles)
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

function getDailyGridSize(dateStr) {
  const sizes = [5, 7, 9];
  const seed = getDailySeed(dateStr + '-size');
  return sizes[seed % sizes.length];
}

/* ==========================================================================
   2. DIRECTIONS & UTILITIES
   ========================================================================== */
const DIRS = [
  { dr: -1, dc: 0, bit: 1 },  // N
  { dr: 0, dc: 1, bit: 2 },   // E
  { dr: 1, dc: 0, bit: 4 },   // S
  { dr: 0, dc: -1, bit: 8 }   // W
];

const OPPOSITE = [2, 3, 0, 1];

function rotateMaskClockwise(mask) {
  let newMask = 0;
  if (mask & 1) newMask |= 2;
  if (mask & 2) newMask |= 4;
  if (mask & 4) newMask |= 8;
  if (mask & 8) newMask |= 1;
  return newMask;
}

function countBits(n) {
  let count = 0;
  while (n) {
    count += n & 1;
    n >>= 1;
  }
  return count;
}

export default function Pipes() {
  const todayStr = new Date().toISOString().split('T')[0];

  const [gameMode, setGameMode] = useState('daily');
  const [gridSize, setGridSize] = useState(() => getDailyGridSize(todayStr));
  const [userGrid, setUserGrid] = useState([]);
  const [lockedGrid, setLockedGrid] = useState([]);
  const [poweredGrid, setPoweredGrid] = useState([]);
  const [isWon, setIsWon] = useState(false);
  const [serverPos, setServerPos] = useState({ r: 0, c: 0 });

  // Timer States
  const [seconds, setSeconds] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);

  const canvasRef = useRef(null);

  const getCellSize = useCallback((size) => {
    const availableWidth = Math.min(window.innerWidth - 32, 480);
    return Math.floor(availableWidth / size);
  }, []);

  const [cellSize, setCellSize] = useState(() => getCellSize(gridSize));

  // Timer Effect
  useEffect(() => {
    let interval = null;
    if (isTimerActive && !isWon) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, isWon]);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /* ==========================================================================
     PUZZLE GENERATOR & STORAGE LOADER
     ========================================================================== */
  const generatePuzzle = useCallback((size, mode) => {
    // If loading daily mode, check local storage for saved state first
    if (mode === 'daily') {
      const savedData = localStorage.getItem(`pipes-daily-${todayStr}`);
      if (savedData) {
        try {
          const { grid, locked, time, completed, server } = JSON.parse(savedData);
          if (grid && grid.length === size) {
            setServerPos(server || { r: Math.floor(size / 2), c: Math.floor(size / 2) });
            setUserGrid(grid);
            setLockedGrid(locked || Array(size).fill(null).map(() => Array(size).fill(false)));
            setSeconds(time || 0);
            setIsWon(Boolean(completed));
            setIsTimerActive(!completed);
            return;
          }
        } catch (err) {
          console.error("Error reading saved daily game:", err);
        }
      }
    }

    // Generate fresh board if no saved daily state exists or if playing custom mode
    const sR = Math.floor(size / 2);
    const sC = Math.floor(size / 2);
    setServerPos({ r: sR, c: sC });

    let rng = Math.random;
    if (mode === 'daily') {
      const seed = getDailySeed(todayStr);
      rng = mulberry32(seed);
    }

    const solGrid = Array(size).fill(null).map(() => Array(size).fill(0));
    const visited = Array(size).fill(null).map(() => Array(size).fill(false));
    const edges = [];

    const addEdges = (r, c) => {
      for (let dir = 0; dir < 4; dir++) {
        const nr = r + DIRS[dir].dr;
        const nc = c + DIRS[dir].dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size && !visited[nr][nc]) {
          edges.push({ r1: r, c1: c, r2: nr, c2: nc, dir });
        }
      }
    };

    visited[sR][sC] = true;
    addEdges(sR, sC);

    while (edges.length > 0) {
      const randIdx = Math.floor(rng() * edges.length);
      const { r1, c1, r2, c2, dir } = edges[randIdx];
      edges.splice(randIdx, 1);

      if (!visited[r2][c2]) {
        visited[r2][c2] = true;
        solGrid[r1][c1] |= DIRS[dir].bit;
        solGrid[r2][c2] |= DIRS[OPPOSITE[dir]].bit;
        addEdges(r2, c2);
      }
    }

    const newUserGrid = Array(size).fill(null).map(() => Array(size).fill(0));
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        let mask = solGrid[r][c];
        const rotations = Math.floor(rng() * 4);
        for (let i = 0; i < rotations; i++) {
          mask = rotateMaskClockwise(mask);
        }
        newUserGrid[r][c] = mask;
      }
    }

    const initialLocked = Array(size).fill(null).map(() => Array(size).fill(false));
    setUserGrid(newUserGrid);
    setLockedGrid(initialLocked);
    setIsWon(false);
    setSeconds(0);
    setIsTimerActive(true);

    if (mode === 'daily') {
      localStorage.setItem(
        `pipes-daily-${todayStr}`,
        JSON.stringify({
          grid: newUserGrid,
          locked: initialLocked,
          time: 0,
          completed: false,
          server: { r: sR, c: sC }
        })
      );
    }
  }, [todayStr]);

  const handleModeChange = (mode) => {
    setGameMode(mode);
    if (mode === 'daily') {
      const dailySize = getDailyGridSize(todayStr);
      setGridSize(dailySize);
      generatePuzzle(dailySize, 'daily');
    } else {
      generatePuzzle(gridSize, 'custom');
    }
  };

  /* ==========================================================================
     POWER BFS & WIN EVALUATION
     ========================================================================== */
  const updatePowerState = useCallback((grid, size, sPos) => {
    if (!grid.length) return;

    const newPowered = Array(size).fill(null).map(() => Array(size).fill(false));
    const queue = [[sPos.r, sPos.c]];
    newPowered[sPos.r][sPos.c] = true;

    while (queue.length > 0) {
      const [r, c] = queue.shift();
      const currentMask = grid[r][c];

      for (let dir = 0; dir < 4; dir++) {
        if (currentMask & DIRS[dir].bit) {
          const nr = r + DIRS[dir].dr;
          const nc = c + DIRS[dir].dc;

          if (nr >= 0 && nr < size && nc >= 0 && nc < size && !newPowered[nr][nc]) {
            const neighborMask = grid[nr][nc];
            if (neighborMask & DIRS[OPPOSITE[dir]].bit) {
              newPowered[nr][nc] = true;
              queue.push([nr, nc]);
            }
          }
        }
      }
    }

    setPoweredGrid(newPowered);

    let allPowered = true;
    let noMismatches = true;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!newPowered[r][c]) {
          allPowered = false;
          break;
        }

        const mask = grid[r][c];
        for (let dir = 0; dir < 4; dir++) {
          if (mask & DIRS[dir].bit) {
            const nr = r + DIRS[dir].dr;
            const nc = c + DIRS[dir].dc;

            if (nr < 0 || nr >= size || nc < 0 || nc >= size) {
              noMismatches = false;
            } else if (!(grid[nr][nc] & DIRS[OPPOSITE[dir]].bit)) {
              noMismatches = false;
            }
          }
        }
      }
    }

    const won = allPowered && noMismatches;
    setIsWon(won);
    if (won) {
      setIsTimerActive(false);
    }
  }, []);

  // Sync daily state changes back to localStorage
  const saveDailyState = useCallback((grid, locked, wonState, currentTime) => {
    if (gameMode === 'daily') {
      localStorage.setItem(
        `pipes-daily-${todayStr}`,
        JSON.stringify({
          grid,
          locked,
          time: currentTime,
          completed: wonState,
          server: serverPos
        })
      );
    }
  }, [gameMode, todayStr, serverPos]);

  useEffect(() => {
    const handleResize = () => {
      setCellSize(getCellSize(gridSize));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridSize, getCellSize]);

  // Initial mount load
  useEffect(() => {
    generatePuzzle(gridSize, gameMode);
  }, []);

  useEffect(() => {
    if (userGrid.length && userGrid.length === gridSize) {
      updatePowerState(userGrid, gridSize, serverPos);
    }
  }, [userGrid, gridSize, serverPos, updatePowerState]);

  /* ==========================================================================
     CANVAS RENDERER
     ========================================================================== */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (
      !canvas ||
      !userGrid.length ||
      userGrid.length !== gridSize ||
      !poweredGrid.length ||
      poweredGrid.length !== gridSize
    ) return;

    const ctx = canvas.getContext('2d');
    const width = cellSize * gridSize;
    canvas.width = width;
    canvas.height = width;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const halfCell = cellSize / 2;
    const outerR = Math.max(4, Math.floor(cellSize * 0.20));
    const bulbR = Math.max(6, Math.floor(cellSize * 0.30));

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const x = c * cellSize;
        const y = r * cellSize;
        const cx = x + halfCell;
        const cy = y + halfCell;
        const mask = userGrid[r][c];
        const isPowered = poweredGrid[r]?.[c] ?? false;
        const isLocked = lockedGrid[r]?.[c] ?? false;
        const isServer = (r === serverPos.r && c === serverPos.c);
        const connectionCount = countBits(mask);

        const borderWidth = isPowered ? 3.5 : 2.5;
        const innerR = Math.max(1, outerR - borderWidth);

        ctx.fillStyle = isLocked ? '#080a0d' : '#161a22';
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

        if (isServer) {
          ctx.fillStyle = 'rgba(57, 255, 20, 0.12)';
          ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
          ctx.strokeStyle = '#39ff14';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
        }

        if (connectionCount === 0) continue;

        const borderColor = isPowered
          ? 'rgb(255, 182, 193)'
          : 'rgba(255, 182, 193, 0.85)';

        const fluidColor = isPowered
          ? 'rgba(57, 255, 20, 0.75)'
          : '#0d0f12';

        const buildPipePath = (radius, endpointCapRadius) => {
          ctx.beginPath();
          ctx.rect(cx - radius, cy - radius, radius * 2, radius * 2);

          if (mask & 1) ctx.rect(cx - radius, y, radius * 2, halfCell);
          if (mask & 2) ctx.rect(cx, cy - radius, halfCell, radius * 2);
          if (mask & 4) ctx.rect(cx - radius, cy, radius * 2, halfCell);
          if (mask & 8) ctx.rect(x, cy - radius, halfCell, radius * 2);

          if (connectionCount === 1) {
            ctx.arc(cx, cy, endpointCapRadius, 0, Math.PI * 2);
          }
        };

        ctx.fillStyle = borderColor;
        buildPipePath(outerR, bulbR);
        ctx.fill();

        ctx.fillStyle = fluidColor;
        buildPipePath(innerR, bulbR - borderWidth);
        ctx.fill();

        if (isLocked) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        }
      }
    }
  }, [userGrid, poweredGrid, lockedGrid, gridSize, cellSize, serverPos]);

  /* ==========================================================================
     CLICK HANDLERS (ROTATE & LOCK)
     ========================================================================== */
  const handleLeftClick = (r, c) => {
    if (isWon || lockedGrid[r]?.[c]) return;

    setUserGrid((prevGrid) => {
      const nextGrid = prevGrid.map((row) => [...row]);
      nextGrid[r][c] = rotateMaskClockwise(nextGrid[r][c]);
      saveDailyState(nextGrid, lockedGrid, isWon, seconds);
      return nextGrid;
    });
  };

  const handleRightClick = (r, c) => {
    if (isWon) return;

    setLockedGrid((prevLocked) => {
      const nextLocked = prevLocked.map((row) => [...row]);
      nextLocked[r][c] = !nextLocked[r][c];
      saveDailyState(userGrid, nextLocked, isWon, seconds);
      return nextLocked;
    });
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const c = Math.floor(x / cellSize);
    const r = Math.floor(y / cellSize);

    if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
      handleLeftClick(r, c);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const c = Math.floor(x / cellSize);
    const r = Math.floor(y / cellSize);

    if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
      handleRightClick(r, c);
    }
  };

  const neonPinkBtnStyle = {
    backgroundColor: '#ff10f0',
    color: '#ffffff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '0 0 10px rgba(255, 16, 240, 0.5)',
    transition: 'all 0.2s ease-in-out'
  };

  const neonBlueBtnStyle = {
    backgroundColor: '#00f0ff',
    color: '#080a0d',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '0 0 10px rgba(0, 240, 255, 0.5)',
    transition: 'all 0.2s ease-in-out'
  };

  const inactiveBtnStyle = {
    backgroundColor: '#222831',
    color: '#aaaaaa',
    border: '1px solid #333',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'normal'
  };

  return (
    <div className="pipes-container">
      <Navbar />
      <h1 className="pipes-title">SKEETER PIPER</h1>
      <p className="pipes-instructions">
        Left-click to rotate pipes clockwise. Right-click to lock/darken cells you know are correct!
      </p>

      {/* Mode Switcher Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', justifyContent: 'center' }}>
        <button
          style={gameMode === 'daily' ? neonPinkBtnStyle : inactiveBtnStyle}
          onClick={() => handleModeChange('daily')}
        >
          📅 Daily Challenge ({gridSize}x{gridSize})
        </button>
        <button
          style={gameMode === 'custom' ? neonBlueBtnStyle : inactiveBtnStyle}
          onClick={() => handleModeChange('custom')}
        >
          🎲 Custom Game
        </button>
      </div>

      <div className="pipes-config" style={{ gap: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {gameMode === 'custom' ? (
          <div>
            <label htmlFor="pipes-grid-size">Grid Size: </label>
            <select
              id="pipes-grid-size"
              value={gridSize}
              onChange={(e) => {
                const newSize = parseInt(e.target.value, 10);
                setGridSize(newSize);
                generatePuzzle(newSize, 'custom');
              }}
            >
              <option value={5}>5 x 5</option>
              <option value={7}>7 x 7</option>
              <option value={9}>9 x 9</option>
            </select>
          </div>
        ) : (
          <div style={{ fontWeight: '500' }}>
            Today's Date: <strong>{todayStr}</strong>
          </div>
        )}

        {/* Timer Display */}
        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#00f0ff', textShadow: '0 0 5px rgba(0, 240, 255, 0.7)' }}>
          ⏱️ {formatTime(seconds)}
        </div>
      </div>

      <div className="pipes-board-wrapper">
        <canvas
          ref={canvasRef}
          className="pipes-canvas"
          onClick={handleCanvasClick}
          onContextMenu={handleContextMenu}
        />
      </div>

      <div className={`pipes-status ${isWon ? 'win' : ''}`}>
        {isWon ? `🎉 All Pipes Connected in ${formatTime(seconds)}!` : ''}
      </div>

      <div className="pipes-controls" style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '12px' }}>
        {gameMode === 'custom' && (
          <button style={neonBlueBtnStyle} onClick={() => generatePuzzle(gridSize, 'custom')}>
            New Game
          </button>
        )}
      </div>
      <div style={{ marginTop: '24px' }}>
        <FeedbackForm />
      </div>
    </div>
  );
}