import React, { useState, useEffect, useRef, useCallback } from 'react';
import './shikaku.css';
import Navbar from '../../components/Navbar';

/* ==========================================================================
   1. HIGH-PERFORMANCE FAST GENERATOR (Recursive Slicing Algorithm)
   ========================================================================== */

/**
 * Splits a bounding rectangle (r1, c1, r2, c2) recursively into 
 * smaller sub-rectangles until target constraints are met.
 */
function partitionArea(r1, r2, c1, c2, rects, minArea = 2, maxAreaRatio = 0.15) {
  const height = r2 - r1 + 1;
  const width = c2 - c1 + 1;
  const area = height * width;

  const maxAllowedArea = Math.max(6, Math.floor((r2 + 1) * (c2 + 1) * maxAreaRatio));

  // Determine if valid cuts exist where BOTH resulting pieces will have area >= minArea (2)
  const validHorizontalCuts = [];
  for (let cut = r1; cut < r2; cut++) {
    const topArea = (cut - r1 + 1) * width;
    const botArea = (r2 - cut) * width;
    if (topArea >= minArea && botArea >= minArea) {
      validHorizontalCuts.push(cut);
    }
  }

  const validVerticalCuts = [];
  for (let cut = c1; cut < c2; cut++) {
    const leftArea = height * (cut - c1 + 1);
    const rightArea = height * (c2 - cut);
    if (leftArea >= minArea && rightArea >= minArea) {
      validVerticalCuts.push(cut);
    }
  }

  const canSplitH = validHorizontalCuts.length > 0;
  const canSplitV = validVerticalCuts.length > 0;

  const shouldSplit = (area > maxAllowedArea) || (area >= minArea * 2 && Math.random() < 0.70);

  if (!shouldSplit || (!canSplitH && !canSplitV)) {
    rects.push({ r1, r2, c1, c2, area });
    return;
  }

  // Choose orientation based on valid options and dimensions
  let splitHorizontally = false;
  if (canSplitH && canSplitV) {
    if (height > width) splitHorizontally = Math.random() < 0.7;
    else if (width > height) splitHorizontally = Math.random() < 0.3;
    else splitHorizontally = Math.random() < 0.5;
  } else {
    splitHorizontally = canSplitH;
  }

  if (splitHorizontally) {
    const cut = validHorizontalCuts[Math.floor(Math.random() * validHorizontalCuts.length)];
    partitionArea(r1, cut, c1, c2, rects, minArea, maxAreaRatio);
    partitionArea(cut + 1, r2, c1, c2, rects, minArea, maxAreaRatio);
  } else {
    const cut = validVerticalCuts[Math.floor(Math.random() * validVerticalCuts.length)];
    partitionArea(r1, r2, c1, cut, rects, minArea, maxAreaRatio);
    partitionArea(r1, r2, cut + 1, c2, rects, minArea, maxAreaRatio);
  }
}

/**
 * Post-processing pass to merge adjacent small rectangles (areas 2 & 3)
 * into larger valid rectangles to reduce small-clue clutter.
 */
function mergeSmallRectangles(rects, maxSmallPercentage = 0.20) {
  let smallCount = rects.filter((r) => r.area <= 3).length;

  for (let passes = 0; passes < 10; passes++) {
    if (smallCount / rects.length <= maxSmallPercentage) break;

    let merged = false;
    for (let i = 0; i < rects.length; i++) {
      if (rects[i].area > 3) continue;

      for (let j = i + 1; j < rects.length; j++) {
        if (rects[j].area > 3) continue;

        const a = rects[i];
        const b = rects[j];

        // Check if a and b can merge vertically into one rectangle
        if (a.c1 === b.c1 && a.c2 === b.c2 && (a.r2 + 1 === b.r1 || b.r2 + 1 === a.r1)) {
          const newR1 = Math.min(a.r1, b.r1);
          const newR2 = Math.max(a.r2, b.r2);
          const newArea = (newR2 - newR1 + 1) * (a.c2 - a.c1 + 1);

          rects[i] = { r1: newR1, r2: newR2, c1: a.c1, c2: a.c2, area: newArea };
          rects.splice(j, 1);
          merged = true;
          break;
        }

        // Check if a and b can merge horizontally into one rectangle
        if (a.r1 === b.r1 && a.r2 === b.r2 && (a.c2 + 1 === b.c1 || b.c2 + 1 === a.c1)) {
          const newC1 = Math.min(a.c1, b.c1);
          const newC2 = Math.max(a.c2, b.c2);
          const newArea = (a.r2 - a.r1 + 1) * (newC2 - newC1 + 1);

          rects[i] = { r1: a.r1, r2: a.r2, c1: newC1, c2: newC2, area: newArea };
          rects.splice(j, 1);
          merged = true;
          break;
        }
      }

      if (merged) break;
    }

    if (!merged) break; // Stop if no further merges are possible
    smallCount = rects.filter((r) => r.area <= 3).length;
  }
}

function generateFastPuzzle(n) {
  const rects = [];
  partitionArea(0, n - 1, 0, n - 1, rects, 2);

  // Merge excess 2s and 3s into larger blocks
  mergeSmallRectangles(rects, 0.15);

  const clues = Array(n).fill(null).map(() => Array(n).fill(0));

  for (const rect of rects) {
    const randomR = rect.r1 + Math.floor(Math.random() * (rect.r2 - rect.r1 + 1));
    const randomC = rect.c1 + Math.floor(Math.random() * (rect.c2 - rect.c1 + 1));
    clues[randomR][randomC] = rect.area;
  }

  return { clues, rects };
}

/* ==========================================================================
   2. REACT COMPONENT
   ========================================================================== */

export default function Shikaku() {
  const [gridSize, setGridSize] = useState(15);
  const [cluesGrid, setCluesGrid] = useState([]);
  const [placedRects, setPlacedRects] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);
  const [status, setStatus] = useState('');
  const [isWin, setIsWin] = useState(false);

  const gridRef = useRef(null);

  const getCellSize = (size) => {
    if (size >= 20) return 22;
    if (size >= 15) return 28;
    if (size >= 10) return 38;
    if (size >= 7) return 46;
    return 54;
  };

  const cellSize = getCellSize(gridSize);

  const startNewGame = useCallback(() => {
    setStatus('');
    setIsWin(false);

    // Instant execution with zero freeze
    const { clues } = generateFastPuzzle(gridSize);
    setCluesGrid(clues);
    setPlacedRects([]);
  }, [gridSize]);

  useEffect(() => {
    startNewGame();
  }, [gridSize, startNewGame]);

  const getGridCoords = (e) => {
    if (!gridRef.current) return { r: 0, c: 0 };
    const rect = gridRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const c = Math.max(0, Math.min(gridSize - 1, Math.floor(x / cellSize)));
    const r = Math.max(0, Math.min(gridSize - 1, Math.floor(y / cellSize)));

    return { r, c };
  };

  const getRectBounds = (start, end) => ({
    r1: Math.min(start.r, end.r),
    r2: Math.max(start.r, end.r),
    c1: Math.min(start.c, end.c),
    c2: Math.max(start.c, end.c)
  });

  const rectsOverlap = (r1, r2) => !(r1.c2 < r2.c1 || r1.c1 > r2.c2 || r1.r2 < r2.r1 || r1.r1 > r2.r2);

  const validateRectangle = (bounds) => {
    if (!cluesGrid.length) return false;
    const area = (bounds.r2 - bounds.r1 + 1) * (bounds.c2 - bounds.c1 + 1);
    const numbersInside = [];

    for (let r = bounds.r1; r <= bounds.r2; r++) {
      for (let c = bounds.c1; c <= bounds.c2; c++) {
        if (cluesGrid[r][c] > 0) {
          numbersInside.push(cluesGrid[r][c]);
        }
      }
    }

    return numbersInside.length === 1 && numbersInside[0] === area;
  };

  const checkWinCondition = (currentRects) => {
    const covered = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
    let totalCoveredCells = 0;

    for (const rect of currentRects) {
      if (!validateRectangle(rect)) {
        setStatus('');
        setIsWin(false);
        return;
      }

      for (let r = rect.r1; r <= rect.r2; r++) {
        for (let c = rect.c1; c <= rect.c2; c++) {
          if (!covered[r][c]) {
            covered[r][c] = true;
            totalCoveredCells++;
          }
        }
      }
    }

    if (totalCoveredCells === gridSize * gridSize) {
      setStatus('🎉 Puzzle Solved!');
      setIsWin(true);
    } else {
      setStatus('');
      setIsWin(false);
    }
  };

  const handleStart = (e) => {
    if (e.target.classList.contains('shikaku-placed-rect')) return;
    const coords = getGridCoords(e);
    setIsDragging(true);
    setDragStart(coords);
    setDragCurrent(coords);
  };

  const handleMove = (e) => {
    if (!isDragging) return;
    setDragCurrent(getGridCoords(e));
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragStart && dragCurrent) {
      const bounds = getRectBounds(dragStart, dragCurrent);
      const filtered = placedRects.filter((rect) => !rectsOverlap(rect, bounds));
      const updated = [...filtered, bounds];
      setPlacedRects(updated);
      checkWinCondition(updated);
    }

    setDragStart(null);
    setDragCurrent(null);
  };

  const handleRectClick = (index, e) => {
    e.stopPropagation();
    const updated = placedRects.filter((_, i) => i !== index);
    setPlacedRects(updated);
    setStatus('');
    setIsWin(false);
  };

  const dragOverlayBounds = isDragging && dragStart && dragCurrent ? getRectBounds(dragStart, dragCurrent) : null;

  return (
    <div className="shikaku-container">
    <Navbar />
      <h1 className="shikaku-title">Skeekaku</h1>

      <div className="shikaku-config">
        <label htmlFor="grid-size-select">Grid Size:</label>
        <select
          id="grid-size-select"
          value={gridSize}
          onChange={(e) => setGridSize(parseInt(e.target.value, 10))}
        >
          <option value={5}>5 x 5</option>
          <option value={7}>7 x 7</option>
          <option value={10}>10 x 10</option>
          <option value={15}>15 x 15</option>
          <option value={20}>20 x 20</option>
        </select>
      </div>

      <div className="shikaku-board-wrapper">
        <div
          ref={gridRef}
          className="shikaku-grid"
          style={{
            gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${gridSize}, ${cellSize}px)`
          }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        >
          {cluesGrid.map((row, r) =>
            row.map((val, c) => (
              <div
                key={`${r}-${c}`}
                className="shikaku-cell"
                style={{
                  fontSize: gridSize >= 20 ? '0.75rem' : gridSize >= 15 ? '0.85rem' : '1.2rem'
                }}
              >
                {val > 0 ? val : ''}
              </div>
            ))
          )}

          {dragOverlayBounds && (
            <div
              className="shikaku-drag-overlay"
              style={{
                top: `${dragOverlayBounds.r1 * cellSize}px`,
                left: `${dragOverlayBounds.c1 * cellSize}px`,
                width: `${(dragOverlayBounds.c2 - dragOverlayBounds.c1 + 1) * cellSize}px`,
                height: `${(dragOverlayBounds.r2 - dragOverlayBounds.r1 + 1) * cellSize}px`
              }}
            />
          )}

          <div className="shikaku-rectangles-layer">
            {placedRects.map((rect, idx) => {
              const isValid = validateRectangle(rect);
              return (
                <div
                  key={idx}
                  className={`shikaku-placed-rect ${isValid ? 'valid' : 'invalid'}`}
                  style={{
                    top: `${rect.r1 * cellSize}px`,
                    left: `${rect.c1 * cellSize}px`,
                    width: `${(rect.c2 - rect.c1 + 1) * cellSize}px`,
                    height: `${(rect.r2 - rect.r1 + 1) * cellSize}px`
                  }}
                  onClick={(e) => handleRectClick(idx, e)}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className={`shikaku-status ${isWin ? 'win' : ''}`}>{status}</div>

      <div className="shikaku-controls">
        <button
          className="shikaku-btn"
          onClick={() => {
            setPlacedRects([]);
            setStatus('');
            setIsWin(false);
          }}
        >
          Reset Board
        </button>
        <button className="shikaku-btn" onClick={startNewGame}>
          Generate New Puzzle
        </button>
      </div>
    </div>
  );
}