// src/games/minesweeper/Minesweeper.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Minesweeper.css';
import Navbar from '../../components/Navbar';

const DIFFICULTY_CONFIGS = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};

export default function Minesweeper() {
  const [difficulty, setDifficulty] = useState('beginner');
  const [board, setBoard] = useState([]);
  const [gameStatus, setGameStatus] = useState('playing');
  const [flagsLeft, setFlagsLeft] = useState(DIFFICULTY_CONFIGS.beginner.mines);
  
  // Clean timer state using start timestamp
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const startTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);

  const { rows, cols, mines } = DIFFICULTY_CONFIGS[difficulty];

  const getNeighbors = useCallback((r, c) => {
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
  }, [rows, cols]);

  // Stop active interval timer
  const stopTimer = useCallback(() => {
    setIsTimerRunning(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  // Initialize fresh board
  const initBoard = useCallback(() => {
    stopTimer();
    setTimer(0);
    startTimeRef.current = null;

    let newBoard = Array(rows).fill(null).map((_, r) =>
      Array(cols).fill(null).map((_, c) => ({
        row: r,
        col: c,
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        neighborMines: 0,
      }))
    );

    let placedMines = 0;
    while (placedMines < mines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
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

    setBoard(newBoard);
    setGameStatus('playing');
    setFlagsLeft(mines);
  }, [rows, cols, mines, getNeighbors, stopTimer]);

  useEffect(() => {
    initBoard();
    return () => stopTimer();
  }, [initBoard, stopTimer]);

  // Start timer on first move
  const startTimerIfNeeded = () => {
    if (!isTimerRunning && gameStatus === 'playing') {
      setIsTimerRunning(true);
      startTimeRef.current = Date.now();
      timerIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setTimer(Math.min(seconds, 999));
        }
      }, 200); // Polls every 200ms to guarantee smooth second ticking
    }
  };

  const revealTile = (r, c, currentBoard) => {
    if (
      r < 0 || r >= rows || c < 0 || c >= cols ||
      currentBoard[r][c].isRevealed || currentBoard[r][c].isFlagged
    ) {
      return;
    }

    currentBoard[r][c].isRevealed = true;

    if (currentBoard[r][c].neighborMines === 0 && !currentBoard[r][c].isMine) {
      getNeighbors(r, c).forEach(([nr, nc]) => {
        revealTile(nr, nc, currentBoard);
      });
    }
  };

  const handleCellClick = (r, c) => {
    if (gameStatus !== 'playing') return;
    const cell = board[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

    startTimerIfNeeded();

    const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));

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

  const handleContextMenu = (e, r, c) => {
    e.preventDefault();
    if (gameStatus !== 'playing') return;
    const cell = board[r][c];
    if (cell.isRevealed) return;

    startTimerIfNeeded();

    const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
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
      const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
      let hitMine = false;

      neighbors.forEach(([nr, nc]) => {
        const neighborCell = newBoard[nr][nc];
        if (!neighborCell.isFlagged && !neighborCell.isRevealed) {
          if (neighborCell.isMine) {
            hitMine = true;
          }
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

  const formatDigits = (num) => {
    const clamped = Math.max(-99, Math.min(999, num));
    return String(clamped).padStart(3, '0');
  };

  return (
    <div className="minesweeper-container">
    <Navbar />
      <h2 className="ms-title">MINESKEETER</h2>

      <div className="diff-toggle">
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

      <div className="ms-classic-window">
        <div className="ms-classic-header">
          <div className="ms-digital-display">{formatDigits(flagsLeft)}</div>

          <button className="ms-face-btn" onClick={initBoard}>
            {gameStatus === 'won' ? '😎' : gameStatus === 'lost' ? '💀' : '🙂'}
          </button>

          <div className="ms-digital-display">{formatDigits(timer)}</div>
        </div>

        <div className="ms-classic-board">
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
                    className={`ms-classic-cell ${cell.isRevealed ? 'revealed' : 'unrevealed'} num-${cell.neighborMines}`}
                    onClick={() => {
                      if (cell.isRevealed) {
                        handleChord(r, c);
                      } else {
                        handleCellClick(r, c);
                      }
                    }}
                    onContextMenu={(e) => handleContextMenu(e, r, c)}
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
  );
}