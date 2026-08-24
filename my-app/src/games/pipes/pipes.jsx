import React, { useState, useEffect, useRef, useCallback } from 'react';
import './pipes.css';

/* ==========================================================================
   DIRECTIONS & UTILITIES
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
  const [gridSize, setGridSize] = useState(7);
  const [userGrid, setUserGrid] = useState([]);
  const [lockedGrid, setLockedGrid] = useState([]);
  const [poweredGrid, setPoweredGrid] = useState([]);
  const [isWon, setIsWon] = useState(false);
  const [serverPos, setServerPos] = useState({ r: 0, c: 0 });

  const canvasRef = useRef(null);

  const getCellSize = useCallback((size) => {
  // Uses screen width minus padding, capped at 480px on desktop
  const availableWidth = Math.min(window.innerWidth - 32, 480);
  return Math.floor(availableWidth / size);
}, []);

  const [cellSize, setCellSize] = useState(() => getCellSize(gridSize));

  /* ==========================================================================
     PUZZLE GENERATOR
     ========================================================================== */
  const generatePuzzle = useCallback((size) => {
    const sR = Math.floor(size / 2);
    const sC = Math.floor(size / 2);
    setServerPos({ r: sR, c: sC });

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
      const randIdx = Math.floor(Math.random() * edges.length);
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
        const rotations = Math.floor(Math.random() * 4);
        for (let i = 0; i < rotations; i++) {
          mask = rotateMaskClockwise(mask);
        }
        newUserGrid[r][c] = mask;
      }
    }

    setUserGrid(newUserGrid);
    setLockedGrid(Array(size).fill(null).map(() => Array(size).fill(false)));
    setIsWon(false);
  }, []);

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

    setIsWon(allPowered && noMismatches);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setCellSize(getCellSize(gridSize));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridSize, getCellSize]);

  useEffect(() => {
    generatePuzzle(gridSize);
  }, [gridSize, generatePuzzle]);

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
    const outerR = Math.max(3, Math.floor(cellSize * 0.16)); 
    const bulbR = Math.max(6, Math.floor(cellSize * 0.28));

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

        const borderWidth = isPowered ? 3.0 : 1.5;
        const innerR = Math.max(1, outerR - borderWidth);

        // 1. Tile Background
        ctx.fillStyle = isLocked ? '#080a0d' : '#161a22';
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

        // Server Indicator
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
          : 'rgba(255, 182, 193, 0.45)';

        const fluidColor = isPowered 
          ? 'rgba(57, 255, 20, 0.65)' 
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

        // 2. Outer Pipe Layer
        ctx.fillStyle = borderColor;
        buildPipePath(outerR, bulbR);
        ctx.fill();

        // 3. Inner Core Layer
        ctx.fillStyle = fluidColor;
        buildPipePath(innerR, bulbR - borderWidth);
        ctx.fill();

        // 4. Locked Tile Dark Overlay
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
      return nextGrid;
    });
  };

  const handleRightClick = (r, c) => {
    if (isWon) return;

    setLockedGrid((prevLocked) => {
      const nextLocked = prevLocked.map((row) => [...row]);
      nextLocked[r][c] = !nextLocked[r][c];
      return nextLocked;
    });
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const c = Math.floor(x / cellSize);
    const r = Math.floor(y / cellSize);

    if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
      handleRightClick(r, c);
    }
  };

  return (
    <div className="pipes-container">
      <h1 className="pipes-title">Skeeter Piper (net)</h1>
      <p className="pipes-instructions">
        Left-click to rotate pipes clockwise. Right-click to lock/darken cells you know are correct!
      </p>

      <div className="pipes-config">
        <label htmlFor="pipes-grid-size">Grid Size:</label>
        <select
          id="pipes-grid-size"
          value={gridSize}
          onChange={(e) => setGridSize(parseInt(e.target.value, 10))}
        >
          <option value={5}>5 x 5</option>
          <option value={7}>7 x 7</option>
          <option value={9}>9 x 9</option>
        </select>
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
        {isWon ? '🎉 All Pipes Connected!' : ''}
      </div>

      <div className="pipes-controls">
        <button className="pipes-btn" onClick={() => generatePuzzle(gridSize)}>
          New Game
        </button>
      </div>
    </div>
  );
}