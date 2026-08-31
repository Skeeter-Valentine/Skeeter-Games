import React, { useState, useEffect, useRef, useCallback } from 'react';
import './shikaku.css';
import Navbar from '../../components/Navbar';
import FeedbackForm from '../../components/Feedback';

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
  const sizes = [5, 7, 10, 15, 20];
  const seed = getDailySeed(dateStr + '-size');
  return sizes[seed % sizes.length];
}

function partitionArea(r1, r2, c1, c2, rects, minArea = 2, maxAreaRatio = 0.15, rng = Math.random) {
  const height = r2 - r1 + 1;
  const width = c2 - c1 + 1;
  const area = height * width;

  const maxAllowedArea = Math.max(6, Math.floor((r2 + 1) * (c2 + 1) * maxAreaRatio));

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
  const shouldSplit = (area > maxAllowedArea) || (area >= minArea * 2 && rng() < 0.70);

  if (!shouldSplit || (!canSplitH && !canSplitV)) {
    rects.push({ r1, r2, c1, c2, area });
    return;
  }

  let splitHorizontally = false;
  if (canSplitH && canSplitV) {
    if (height > width) splitHorizontally = rng() < 0.7;
    else if (width > height) splitHorizontally = rng() < 0.3;
    else splitHorizontally = rng() < 0.5;
  } else {
    splitHorizontally = canSplitH;
  }

  if (splitHorizontally) {
    const cut = validHorizontalCuts[Math.floor(rng() * validHorizontalCuts.length)];
    partitionArea(r1, cut, c1, c2, rects, minArea, maxAreaRatio, rng);
    partitionArea(cut + 1, r2, c1, c2, rects, minArea, maxAreaRatio, rng);
  } else {
    const cut = validVerticalCuts[Math.floor(rng() * validVerticalCuts.length)];
    partitionArea(r1, r2, c1, cut, rects, minArea, maxAreaRatio, rng);
    partitionArea(r1, r2, cut + 1, c2, rects, minArea, maxAreaRatio, rng);
  }
}

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

        if (a.c1 === b.c1 && a.c2 === b.c2 && (a.r2 + 1 === b.r1 || b.r2 + 1 === a.r1)) {
          const newR1 = Math.min(a.r1, b.r1);
          const newR2 = Math.max(a.r2, b.r2);
          const newArea = (newR2 - newR1 + 1) * (a.c2 - a.c1 + 1);

          rects[i] = { r1: newR1, r2: newR2, c1: a.c1, c2: a.c2, area: newArea };
          rects.splice(j, 1);
          merged = true;
          break;
        }

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

    if (!merged) break;
    smallCount = rects.filter((r) => r.area <= 3).length;
  }
}

function generateFastPuzzle(n, rng = Math.random) {
  const rects = [];
  partitionArea(0, n - 1, 0, n - 1, rects, 2, 0.15, rng);
  mergeSmallRectangles(rects, 0.15);

  const clues = Array(n).fill(null).map(() => Array(n).fill(0));

  for (const rect of rects) {
    const randomR = rect.r1 + Math.floor(rng() * (rect.r2 - rect.r1 + 1));
    const randomC = rect.c1 + Math.floor(rng() * (rect.c2 - rect.c1 + 1));
    clues[randomR][randomC] = rect.area;
  }

  return { clues, rects };
}

export default function Shikaku() {
  const todayStr = new Date().toISOString().split('T')[0];

  const [gameMode, setGameMode] = useState('daily');
  const [gridSize, setGridSize] = useState(() => getDailyGridSize(todayStr));
  const [cluesGrid, setCluesGrid] = useState([]);
  const [placedRects, setPlacedRects] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);
  const [status, setStatus] = useState('');
  const [isWin, setIsWin] = useState(false);
  
  const [showCounter, setShowCounter] = useState(true);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const [seconds, setSeconds] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(true);

  const gridRef = useRef(null);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let interval = null;
    if (isTimerActive && !isWin) {
      interval = setInterval(() => {
        setSeconds((prevSeconds) => prevSeconds + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, isWin]);

  const startNewGame = useCallback((overrideMode = gameMode, overrideSize = gridSize) => {
    setStatus('');

    let clues;
    if (overrideMode === 'daily') {
      const dailySize = getDailyGridSize(todayStr);
      setGridSize(dailySize);
      const seed = getDailySeed(todayStr);
      const rng = mulberry32(seed);
      clues = generateFastPuzzle(dailySize, rng).clues;
      setCluesGrid(clues);

      const saved = localStorage.getItem(`shikaku-daily-state-${todayStr}`);
      if (saved) {
        try {
          const { placedRects: savedRects, seconds: savedSeconds, isWin: savedWin } = JSON.parse(saved);
          setPlacedRects(savedRects || []);
          setSeconds(savedSeconds || 0);
          setIsWin(!!savedWin);
          setIsTimerActive(!savedWin);
          if (savedWin) {
            setStatus(`🎉 Daily Puzzle Solved in ${formatTime(savedSeconds || 0)}!`);
          }
          return;
        } catch (err) {
          // Fall through on error
        }
      }
    } else {
      clues = generateFastPuzzle(overrideSize, Math.random).clues;
      setCluesGrid(clues);
    }

    setPlacedRects([]);
    setSeconds(0);
    setIsWin(false);
    setIsTimerActive(true);
  }, [gameMode, gridSize, todayStr]);

  useEffect(() => {
    startNewGame();
  }, [gameMode, startNewGame]);

  useEffect(() => {
    if (gameMode === 'daily' && cluesGrid.length > 0) {
      const dailyState = {
        placedRects,
        seconds,
        isWin,
      };
      localStorage.setItem(`shikaku-daily-state-${todayStr}`, JSON.stringify(dailyState));
    }
  }, [placedRects, seconds, isWin, gameMode, cluesGrid, todayStr]);

  const handleModeChange = (mode) => {
    setGameMode(mode);
    if (mode === 'daily') {
      const dailySize = getDailyGridSize(todayStr);
      setGridSize(dailySize);
    }
  };

  const getCellSize = (size) => {
    const isMobile = window.innerWidth <= 480;
    if (size >= 20) return isMobile ? 16 : 22;
    if (size >= 15) return isMobile ? 22 : 28;
    if (size >= 10) return isMobile ? 30 : 38;
    if (size >= 7) return isMobile ? 38 : 46;
    return isMobile ? 44 : 54;
  };

  const cellSize = getCellSize(gridSize);

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
      const modeText = gameMode === 'daily' ? 'Daily Puzzle' : 'Puzzle';
      setStatus(`🎉 ${modeText} Solved in ${formatTime(seconds)}!`);
      setIsWin(true);
      setIsTimerActive(false);
    } else {
      setStatus('');
      setIsWin(false);
    }
  };

  const handleStart = (e) => {
    if (e.touches && e.touches.length >= 2) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    if (e.target.classList.contains('shikaku-placed-rect')) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setCursorPos({ x: clientX, y: clientY });

    const coords = getGridCoords(e);
    setIsDragging(true);
    setDragStart(coords);
    setDragCurrent(coords);
  };

  const handleMove = (e) => {
    if (e.touches && e.touches.length >= 2) {
      if (isDragging) {
        setIsDragging(false);
        setDragStart(null);
        setDragCurrent(null);
      }
      return;
    }

    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setCursorPos({ x: clientX, y: clientY });

    setDragCurrent(getGridCoords(e));
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragStart && dragCurrent) {
      const bounds = getRectBounds(dragStart, dragCurrent);
      const area = (bounds.r2 - bounds.r1 + 1) * (bounds.c2 - bounds.c1 + 1);

      if (area > 1) {
        const filtered = placedRects.filter((rect) => !rectsOverlap(rect, bounds));
        const updated = [...filtered, bounds];
        setPlacedRects(updated);
        checkWinCondition(updated);
      }
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
  const highlightedWidth = dragOverlayBounds ? dragOverlayBounds.c2 - dragOverlayBounds.c1 + 1 : 0;
  const highlightedHeight = dragOverlayBounds ? dragOverlayBounds.r2 - dragOverlayBounds.r1 + 1 : 0;
  const highlightedArea = highlightedWidth * highlightedHeight;

  return (
    <div className="shikaku-container">
      <Navbar />
      <h1 className="shikaku-title">SKEEKAKU</h1>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button
          className={`shikaku-btn ${gameMode === 'daily' ? 'active' : ''}`}
          onClick={() => handleModeChange('daily')}
          style={{
            fontWeight: gameMode === 'daily' ? 'bold' : 'normal',
            backgroundColor: gameMode === 'daily' ? '#00f0ff' : '#333',
            color: gameMode === 'daily' ? '#333' : '#fff'
          }}
        >
          Daily Challenge ({gridSize}x{gridSize})
        </button>
        <button
          className={`shikaku-btn ${gameMode === 'custom' ? 'active' : ''}`}
          onClick={() => handleModeChange('custom')}
          style={{
            fontWeight: gameMode === 'custom' ? 'bold' : 'normal',
            backgroundColor: gameMode === 'custom' ? '#ff10f0' : '#333',
            color: gameMode === 'custom' ? '#fff' : '#fff'
          }}
        >
          Custom Game
        </button>
      </div>

      <div className="shikaku-config" style={{ gap: '16px', flexWrap: 'wrap' }}>
        {gameMode === 'custom' ? (
          <div>
            <label htmlFor="grid-size-select">Grid Size: </label>
            <select
              id="grid-size-select"
              value={gridSize}
              onChange={(e) => {
                const newSize = parseInt(e.target.value, 10);
                setGridSize(newSize);
                startNewGame('custom', newSize);
              }}
            >
              <option value={5}>5 x 5</option>
              <option value={7}>7 x 7</option>
              <option value={10}>10 x 10</option>
              <option value={15}>15 x 15</option>
              <option value={20}>20 x 20</option>
            </select>
          </div>
        ) : (
          <div style={{ fontWeight: '500' }}>
            <strong>{todayStr}</strong>
          </div>
        )}

        <div style={{ fontWeight: 'bold', fontSize: '1rem', minWidth: '90px' }}>
          ⏱️ {formatTime(seconds)}
        </div>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showCounter}
            onChange={(e) => setShowCounter(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Show Cell Counter
        </label>
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
                width: `${highlightedWidth * cellSize}px`,
                height: `${highlightedHeight * cellSize}px`
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

      {isDragging && showCounter && dragOverlayBounds && (
        <div
          style={{
            position: 'fixed',
            left: `${cursorPos.x + 15}px`,
            top: `${cursorPos.y - 25}px`,
            backgroundColor: 'rgba(20, 20, 20, 0.9)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 'bold',
            pointerEvents: 'none',
            zIndex: 9999,
            boxShadow: '0px 2px 8px rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap'
          }}
        >
          {highlightedArea}
        </div>
      )}

      <div className={`shikaku-status ${isWin ? 'win' : ''}`}>{status}</div>

      <div className="shikaku-controls">
        <button
          className="shikaku-btn"
          onClick={() => {
            if (gameMode === 'daily') {
              localStorage.removeItem(`shikaku-daily-state-${todayStr}`);
            }
            setPlacedRects([]);
            setStatus('');
            setIsWin(false);
            setSeconds(0);
            setIsTimerActive(true);
          }}
        >
          Reset Board
        </button>
        {gameMode === 'custom' && (
          <button className="shikaku-btn" onClick={() => startNewGame('custom', gridSize)}>
            Generate New Puzzle
          </button>
        )}
      </div>

      <div style={{ marginTop: '24px' }}>
        <FeedbackForm />
      </div>
    </div>
  );
}