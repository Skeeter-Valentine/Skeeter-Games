import React, {useState, useEffect} from 'react';
// import { Link } from 'react-router-dom';
// import styles from './Minesweeper.module.css';

// export default function Minesweeper() {
//   return (
//     <div className={styles.container}>
//       <h1>💣 Minesweeper Component Working!</h1>
//       <p>This is the separate Minesweeper game file.</p>
//       <Link to="/" className={styles.backLink}>← Back to Home</Link>
//     </div>
//   );
// }



const ROWS = 10;
const COLS = 10;
const MINES = 10;

// Color mapping for numbers
const NUMBER_COLORS = {
  1: '#0000ff', // Blue
  2: '#008000', // Green
  3: '#ff0000', // Red
  4: '#000080', // Dark Blue
  5: '#800000', // Dark Red
  6: '#008080', // Teal
  7: '#000000', // Black
  8: '#808080', // Gray
};

export default function Minesweeper() {
  const [board, setBoard] = useState([]);
  const [mineCount, setMineCount] = useState(MINES);
  const [timer, setTimer] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWin, setIsWin] = useState(false);
  const [firstClick, setFirstClick] = useState(true);
  const [timerActive, setTimerActive] = useState(false);

  const initBoard = () => {
    let newBoard = [];
    for (let r = 0; r < ROWS; r++) {
      let row = [];
      for (let c = 0; c < COLS; c++) {
        row.push({
          r,
          c,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          neighborMines: 0,
        });
      }
      newBoard.push(row);
    }
    return newBoard;
  };

  const resetGame = () => {
    setBoard(initBoard());
    setMineCount(MINES);
    setTimer(0);
    setIsGameOver(false);
    setIsWin(false);
    setFirstClick(true);
    setTimerActive(false);
  };

  useEffect(() => {
    resetGame();
  }, []);

  useEffect(() => {
    let interval = null;
    if (timerActive && !isGameOver) {
      interval = setInterval(() => {
        setTimer((prev) => (prev < 999 ? prev + 1 : 999));
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive, isGameOver]);

  const getNeighbors = (grid, r, c) => {
    const neighbors = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        let nr = r + dr;
        let nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          neighbors.push(grid[nr][nc]);
        }
      }
    }
    return neighbors;
  };

  const placeMines = (grid, safeR, safeC) => {
    let placed = 0;
    while (placed < MINES) {
      let r = Math.floor(Math.random() * ROWS);
      let c = Math.floor(Math.random() * COLS);

      if (!grid[r][c].isMine && !(r === safeR && c === safeC)) {
        grid[r][c].isMine = true;
        placed++;
      }
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!grid[r][c].isMine) {
          const neighbors = getNeighbors(grid, r, c);
          grid[r][c].neighborMines = neighbors.filter((n) => n.isMine).length;
        }
      }
    }
  };

  const checkWin = (grid) => {
    let revealedCount = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c].isRevealed) revealedCount++;
      }
    }
    if (revealedCount === ROWS * COLS - MINES) {
      setIsWin(true);
      setIsGameOver(true);
      setTimerActive(false);
    }
  };

  const revealCellRecursive = (grid, cell) => {
    if (cell.isRevealed || cell.isFlagged) return;

    cell.isRevealed = true;

    if (cell.neighborMines === 0 && !cell.isMine) {
      const neighbors = getNeighbors(grid, cell.r, cell.c);
      neighbors.forEach((neighbor) => revealCellRecursive(grid, neighbor));
    }
  };

  const handleLeftClick = (r, c) => {
    if (isGameOver) return;

    let newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
    let cell = newBoard[r][c];

    if (cell.isFlagged) return;

    if (cell.isRevealed) {
      if (cell.neighborMines > 0) {
        handleChord(newBoard, cell);
      }
      return;
    }

    if (firstClick) {
      setFirstClick(false);
      setTimerActive(true);
      placeMines(newBoard, r, c);
      cell = newBoard[r][c];
    }

    if (cell.isMine) {
      triggerGameOver(newBoard);
      return;
    }

    revealCellRecursive(newBoard, cell);
    setBoard(newBoard);
    checkWin(newBoard);
  };

  const handleChord = (grid, cell) => {
    const neighbors = getNeighbors(grid, cell.r, cell.c);
    const flaggedCount = neighbors.filter((n) => n.isFlagged).length;

    if (flaggedCount === cell.neighborMines) {
      let hitMine = false;

      neighbors.forEach((n) => {
        if (!n.isRevealed && !n.isFlagged) {
          if (n.isMine) {
            hitMine = true;
          } else {
            revealCellRecursive(grid, n);
          }
        }
      });

      if (hitMine) {
        triggerGameOver(grid);
      } else {
        setBoard(grid);
        checkWin(grid);
      }
    }
  };

  const handleRightClick = (e, r, c) => {
    e.preventDefault();
    if (isGameOver || firstClick) return;

    let newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
    let cell = newBoard[r][c];

    if (cell.isRevealed) return;

    if (cell.isFlagged) {
      cell.isFlagged = false;
      setMineCount((prev) => prev + 1);
    } else if (mineCount > 0) {
      cell.isFlagged = true;
      setMineCount((prev) => prev - 1);
    }

    setBoard(newBoard);
  };

  const triggerGameOver = (grid) => {
    setIsGameOver(true);
    setTimerActive(false);

    grid.forEach((row) => {
      row.forEach((cell) => {
        if (cell.isMine) cell.isRevealed = true;
      });
    });

    setBoard(grid);
  };

  // Styles
  const styles = {
    container: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#c0c0c0',
      userSelect: 'none',
      fontFamily: 'Arial, sans-serif',
    },
    gameWindow: {
      border: '3px solid #fff',
      borderRightColor: '#808080',
      borderBottomColor: '#808080',
      backgroundColor: '#c0c0c0',
      padding: '10px',
    },
    header: {
      border: '2px solid #808080',
      borderRightColor: '#fff',
      borderBottomColor: '#fff',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '5px 10px',
      marginBottom: '10px',
      backgroundColor: '#c0c0c0',
    },
    counter: {
      backgroundColor: '#000',
      color: '#ff0000',
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: '24px',
      fontWeight: 'bold',
      padding: '2px 5px',
      width: '50px',
      textAlign: 'center',
    },
    resetBtn: {
      width: '36px',
      height: '36px',
      fontSize: '20px',
      cursor: 'pointer',
      border: '2px solid #fff',
      borderRightColor: '#808080',
      borderBottomColor: '#808080',
      backgroundColor: '#c0c0c0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: `repeat(${COLS}, 30px)`,
      gridTemplateRows: `repeat(${ROWS}, 30px)`,
      border: '3px solid #808080',
      borderRightColor: '#fff',
      borderBottomColor: '#fff',
    },
    cell: {
      width: '30px',
      height: '30px',
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold',
      fontSize: '20px',
      cursor: 'pointer',
      fontFamily: '"Poor Richard", Garamond, Georgia, serif',
    },
    unrevealedCell: {
      backgroundColor: '#c0c0c0',
      border: '2px solid #fff',
      borderRightColor: '#808080',
      borderBottomColor: '#808080',
    },
    revealedCell: {
      border: '1px solid #7b7b7b',
      backgroundColor: '#bdbdbd',
    },
    mineCell: {
      backgroundColor: '#ff0000',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.gameWindow}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.counter}>
            {String(mineCount).padStart(3, '0')}
          </div>

          <button onClick={resetGame} style={styles.resetBtn}>
            {isWin ? '😎' : isGameOver ? '😵' : '😊'}
          </button>

          <div style={styles.counter}>
            {String(timer).padStart(3, '0')}
          </div>
        </div>

        {/* Board Grid */}
        <div style={styles.grid}>
          {board.map((row, rIdx) =>
            row.map((cell, cIdx) => {
              let cellStyle = { ...styles.cell, ...styles.unrevealedCell };

              if (cell.isRevealed) {
                cellStyle = {
                  ...cellStyle,
                  ...styles.revealedCell,
                  ...(cell.isMine ? styles.mineCell : {}),
                };
              }

              return (
                <div
                  key={`${rIdx}-${cIdx}`}
                  onClick={() => handleLeftClick(rIdx, cIdx)}
                  onContextMenu={(e) => handleRightClick(e, rIdx, cIdx)}
                  style={cellStyle}
                >
                  {cell.isRevealed ? (
                    cell.isMine ? (
                      '💣'
                    ) : cell.neighborMines > 0 ? (
                      <span style={{ color: NUMBER_COLORS[cell.neighborMines] }}>
                        {cell.neighborMines}
                      </span>
                    ) : null
                  ) : cell.isFlagged ? (
                    '🚩'
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}