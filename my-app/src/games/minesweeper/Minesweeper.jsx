// src/games/minesweeper/Minesweeper.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Minesweeper.css';
import Navbar from '../../components/Navbar';
import FeedbackForm from '../../components/Feedback';

const DIFFICULTY_CONFIGS = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};

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

function getDailyBoardConfig(dateStr) {
  const configs = [
    { rows: 9, cols: 9, mines: 10 },
    { rows: 12, cols: 12, mines: 22 },
    { rows: 14, cols: 14, mines: 30 },
    { rows: 16, cols: 16, mines: 40 },
    { rows: 16, cols: 30, mines: 99 },
  ];
  const seed = getDailySeed(dateStr + '-minesweeter');
  return configs[seed % configs.length];
}

export default function Minesweeper() {
  const todayStr = new Date().toISOString().split('T')[0];

  const [gameMode, setGameMode] = useState('daily');
  const [difficulty, setDifficulty] = useState('beginner');
  const [board, setBoard] = useState([]);
  const [gameStatus, setGameStatus] = useState('playing');
  const [flagsLeft, setFlagsLeft] = useState(0);

  // Timer state
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const startTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Zoom & Touch state variables
  const [scale, setScale] = useState(1);
  const touchStartDistRef = useRef(null);
  const pressTimerRef = useRef(null);
  const isLongPressRef = useRef(false);

  const activeConfig =
    gameMode === 'daily'
      ? getDailyBoardConfig(todayStr)
      : DIFFICULTY_CONFIGS[difficulty];
  const { rows, cols, mines } = activeConfig;
  const isExpertLayout = gameMode === 'classic' && difficulty === 'expert';

  const getNeighbors = useCallback(
    (r, c) => {
      const neighbors = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            neighbors.push([nr, nc]);
          }
        }
      }
      return neighbors;
    },
    [rows, cols]
  );

  const stopTimer = useCallback(() => {
    setIsTimerRunning(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const revealTile = useCallback(
    (r, c, currentBoard) => {
      if (
        r < 0 ||
        r >= rows ||
        c < 0 ||
        c >= cols ||
        currentBoard[r][c].isRevealed ||
        currentBoard[r][c].isFlagged
      ) {
        return;
      }
      currentBoard[r][c].isRevealed = true;
      if (currentBoard[r][c].neighborMines === 0 && !currentBoard[r][c].isMine) {
        getNeighbors(r, c).forEach(([nr, nc]) => {
          revealTile(nr, nc, currentBoard);
        });
      }
    },
    [rows, cols, getNeighbors]
  );

  const initBoard = useCallback(() => {
    startTimeRef.current = null;
    setScale(1); // Reset zoom on board reset

    if (gameMode === 'daily') {
      const saved = localStorage.getItem(`minesweeper-daily-${todayStr}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setBoard(parsed.board);
          setGameStatus(parsed.gameStatus);
          setFlagsLeft(parsed.flagsLeft);
          setTimer(parsed.timer);
          if (parsed.gameStatus === 'playing' && parsed.timer > 0) {
            startTimeRef.current = Date.now() - parsed.timer * 1000;
            setIsTimerRunning(true);
            timerIntervalRef.current = setInterval(() => {
              if (startTimeRef.current) {
                const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setTimer(Math.min(seconds, 999));
              }
            }, 200);
          }
          return;
        } catch (e) {}
      }
    }

    const rng =
      gameMode === 'daily' ? mulberry32(getDailySeed(todayStr)) : Math.random;

    let newBoard = Array(rows)
      .fill(null)
      .map((_, r) =>
        Array(cols)
          .fill(null)
          .map((_, c) => ({
            row: r,
            col: c,
            isMine: false,
            isRevealed: false,
            isFlagged: false,
            neighborMines: 0,
          }))
      );

    if (gameMode === 'daily') {
      const startR = Math.floor(rng() * rows);
      const startC = Math.floor(rng() * cols);
      const safeZone = new Set();
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = startR + dr;
          const nc = startC + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            safeZone.add(`${nr}-${nc}`);
          }
        }
      }

      let placedMines = 0;
      while (placedMines < mines) {
        const r = Math.floor(rng() * rows);
        const c = Math.floor(rng() * cols);
        if (!safeZone.has(`${r}-${c}`) && !newBoard[r][c].isMine) {
          newBoard[r][c].isMine = true;
          placedMines++;
        }
      }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (newBoard[r][c].isMine) continue;
          let count = 0;
          getNeighbors(r, c).forEach(([nr, nc]) => {
            if (newBoard[nr][nc].isMine) count++;
          });
          newBoard[r][c].neighborMines = count;
        }
      }
      revealTile(startR, startC, newBoard);
    } else {
      let placedMines = 0;
      while (placedMines < mines) {
        const r = Math.floor(rng() * rows);
        const c = Math.floor(rng() * cols);
        if (!newBoard[r][c].isMine) {
          newBoard[r][c].isMine = true;
          placedMines++;
        }
      }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (newBoard[r][c].isMine) continue;
          let count = 0;
          getNeighbors(r, c).forEach(([nr, nc]) => {
            if (newBoard[nr][nc].isMine) count++;
          });
          newBoard[r][c].neighborMines = count;
        }
      }
    }

    setBoard(newBoard);
    setGameStatus('playing');
    setFlagsLeft(mines);
  }, [gameMode, todayStr, rows, cols, mines, getNeighbors, revealTile, stopTimer]);

  useEffect(() => {
    initBoard();
    return () => stopTimer();
  }, [initBoard, stopTimer]);

  const startTimerIfNeeded = () => {
    if (!isTimerRunning && gameStatus === 'playing') {
      setIsTimerRunning(true);
      startTimeRef.current = Date.now() - timer * 1000;
      timerIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setTimer(Math.min(seconds, 999));
        }
      }, 200);
    }
  };

  const checkWinCondition = (currentBoard) => {
    let unrevealedSafeTiles = 0;
    currentBoard.forEach((row) => {
      row.forEach((cell) => {
        if (!cell.isMine && !cell.isRevealed) {
          unrevealedSafeTiles++;
        }
      });
    });

    if (unrevealedSafeTiles === 0) {
      setGameStatus('won');
      setBoard(currentBoard);
      stopTimer();
    } else {
      setBoard(currentBoard);
    }
  };

  const handleCellClick = (r, c) => {
    if (gameStatus !== 'playing') return;
    const cell = board[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

    startTimerIfNeeded();
    const newBoard = board.map((row) => row.map((tile) => ({ ...tile })));

    if (cell.isMine) {
      newBoard.forEach((row) =>
        row.forEach((tile) => {
          if (tile.isMine) tile.isRevealed = true;
        })
      );
      setBoard(newBoard);
      setGameStatus('lost');
      stopTimer();
      return;
    }

    revealTile(r, c, newBoard);
    checkWinCondition(newBoard);
  };

  const toggleFlag = (r, c) => {
    if (gameStatus !== 'playing') return;
    const cell = board[r][c];
    if (cell.isRevealed) return;

    startTimerIfNeeded();
    const newBoard = board.map((row) => row.map((tile) => ({ ...tile })));
    const isFlagged = !cell.isFlagged;
    newBoard[r][c].isFlagged = isFlagged;

    setFlagsLeft((prev) => (isFlagged ? prev - 1 : prev + 1));
    setBoard(newBoard);
    checkWinCondition(newBoard);
  };

  const handleChord = (r, c) => {
    if (gameStatus !== 'playing') return;
    const cell = board[r][c];
    if (!cell.isRevealed || cell.neighborMines === 0) return;

    const neighbors = getNeighbors(r, c);
    let flaggedCount = 0;
    neighbors.forEach(([nr, nc]) => {
      if (board[nr][nc].isFlagged) flaggedCount++;
    });

    if (flaggedCount === cell.neighborMines) {
      startTimerIfNeeded();
      const newBoard = board.map((row) => row.map((tile) => ({ ...tile })));
      let hitMine = false;

      neighbors.forEach(([nr, nc]) => {
        const neighborCell = newBoard[nr][nc];
        if (!neighborCell.isFlagged && !neighborCell.isRevealed) {
          if (neighborCell.isMine) hitMine = true;
          revealTile(nr, nc, newBoard);
        }
      });

      if (hitMine) {
        newBoard.forEach((row) =>
          row.forEach((tile) => {
            if (tile.isMine) tile.isRevealed = true;
          })
        );
        setBoard(newBoard);
        setGameStatus('lost');
        stopTimer();
        return;
      }
      checkWinCondition(newBoard);
    }
  };

  // Pinch-to-Zoom handlers
  const handleTouchStartBoard = (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
    }
  };

  const handleTouchMoveBoard = (e) => {
    if (e.touches.length === 2 && touchStartDistRef.current) {
      e.preventDefault();
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const zoomFactor = currentDist / touchStartDistRef.current;
      setScale((prev) => Math.min(Math.max(prev * zoomFactor, 1), 3.5));
      touchStartDistRef.current = currentDist;
    }
  };

  // Long-press Flag handlers for individual cells
  const handleCellTouchStart = (r, c) => {
    isLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      toggleFlag(r, c);
      if (navigator.vibrate) navigator.vibrate(40);
    }, 450);
  };

  const handleCellTouchEnd = (r, c) => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    if (!isLongPressRef.current) {
      const cell = board[r][c];
      if (cell.isRevealed) {
        handleChord(r, c);
      } else {
        handleCellClick(r, c);
      }
    }
  };

  const formatDigits = (num) => {
    const clamped = Math.max(-99, Math.min(999, num));
    return String(clamped).padStart(3, '0');
  };

  return (
    <div className={`minesweeper-container ${isExpertLayout ? 'expert-mode-active' : ''}`}>
      <Navbar />
      <h2 className="ms-title">MINESWEEPER</h2>

      <div className="diff-toggle">
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
      </div>

      {gameMode === 'classic' && (
        <div className="diff-toggle" style={{ marginTop: '8px' }}>
          <button
            className={`diff-btn ${difficulty === 'beginner' ? 'active' : ''}`}
            onClick={() => setDifficulty('beginner')}
          >
            Beginner
          </button>
          <button
            className={`diff-btn ${difficulty === 'intermediate' ? 'active' : ''}`}
            onClick={() => setDifficulty('intermediate')}
          >
            Intermediate
          </button>
          <button
            className={`diff-btn ${difficulty === 'expert' ? 'active' : ''}`}
            onClick={() => setDifficulty('expert')}
          >
            Expert
          </button>
        </div>
      )}

      <div className="ms-classic-window">
        <div className="ms-classic-header">
          <div className="ms-digital-display">{formatDigits(flagsLeft)}</div>
          <button
            className="ms-face-btn"
            onClick={() => {
              if (gameMode === 'daily') {
                localStorage.removeItem(`minesweeper-daily-${todayStr}`);
              }
              initBoard();
            }}
          >
            {gameStatus === 'won' ? '😎' : gameStatus === 'lost' ? '💀' : '🙂'}
          </button>
          <div className="ms-digital-display">{formatDigits(timer)}</div>
        </div>

        {/* Zoom & Pan Wrapper Container */}
        <div 
          className="ms-zoom-container"
          onTouchStart={handleTouchStartBoard}
          onTouchMove={handleTouchMoveBoard}
        >
          <div 
            className="ms-classic-board"
            style={{ transform: `scale(${scale})` }}
          >
            {board.map((row, r) => (
              <div key={r} className="ms-row">
                {row.map((cell, c) => {
                  let content = '';
                  if (cell.isRevealed) {
                    if (cell.isMine) content = '💣';
                    else if (cell.neighborMines > 0) content = cell.neighborMines;
                  } else if (cell.isFlagged) {
                    content = '🚩';
                  }

                  return (
                    <button
                      key={c}
                      className={`ms-classic-cell ${
                        cell.isRevealed ? 'revealed' : 'unrevealed'
                      } num-${cell.neighborMines}`}
                      onClick={() => {
                        if (cell.isRevealed) handleChord(r, c);
                        else handleCellClick(r, c);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        toggleFlag(r, c);
                      }}
                      onTouchStart={() => handleCellTouchStart(r, c)}
                      onTouchEnd={() => handleCellTouchEnd(r, c)}
                      onMouseDown={(e) => {
                        if (e.button === 1) {
                          e.preventDefault();
                          handleChord(r, c);
                        }
                      }}
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <FeedbackForm />
      </div>
    </div>
  );
}