// src/games/sudoku/Skeedoku.jsx
import React, { useState, useEffect, useRef } from 'react';
import './Sudoku.css';
import Navbar from '../../components/Navbar';

const CONFIGS = {
  '4x4': { size: 4, boxRows: 2, boxCols: 2, clues: 6, label: '4x4 Mini' },
  '6x6': { size: 6, boxRows: 2, boxCols: 3, clues: 18, label: '6x6 (2x3)' },
  easy: { size: 9, boxRows: 3, boxCols: 3, clues: 42, label: 'Easy (9x9)' },
  medium: { size: 9, boxRows: 3, boxCols: 3, clues: 35, label: 'Medium (9x9)' },
  hard: { size: 9, boxRows: 3, boxCols: 3, clues: 29, label: 'Hard (9x9)' },
  expert: { size: 9, boxRows: 3, boxCols: 3, clues: 25, label: 'Expert (9x9)' },
  daily: { size: 9, boxRows: 3, boxCols: 3, clues: 35, label: 'Daily Puzzle' }
};

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export default function Skeedoku() {
  const [configKey, setConfigKey] = useState('daily');
  const cfg = CONFIGS[configKey];
  const size = cfg.size;
  const boxRows = cfg.boxRows;
  const boxCols = cfg.boxCols;

  const [solution, setSolution] = useState([]);
  const [puzzle, setPuzzle] = useState([]);
  const [grid, setGrid] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState(-1);
  const [notesMode, setNotesMode] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({ played: 0, streak: 0, bestTime: null });

  const timerRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('skeedoku_daily_stats');
    if (saved) {
      try { setStats(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const countSolutions = (testGrid, boardSize, rCount, cCount, limit = 2) => {
    const g = [...testGrid];
    let count = 0;

    const validAt = (idx, n) => {
      const r = Math.floor(idx / boardSize), c = idx % boardSize;
      for (let i = 0; i < boardSize; i++) {
        if (g[r * boardSize + i] === n) return false;
        if (g[i * boardSize + c] === n) return false;
      }
      const br = Math.floor(r / rCount) * rCount;
      const bc = Math.floor(c / cCount) * cCount;
      for (let rr = br; rr < br + rCount; rr++) {
        for (let cc = bc; cc < bc + cCount; cc++) {
          if (g[rr * boardSize + cc] === n) return false;
        }
      }
      return true;
    };

    const solve = () => {
      if (count >= limit) return;
      let best = -1, candidates = null;

      for (let i = 0; i < boardSize * boardSize; i++) {
        if (g[i] !== 0) continue;
        const opts = [];
        for (let n = 1; n <= boardSize; n++) if (validAt(i, n)) opts.push(n);
        if (opts.length === 0) return;
        if (!candidates || opts.length < candidates.length) {
          best = i;
          candidates = opts;
          if (opts.length === 1) break;
        }
      }

      if (best === -1) {
        count++;
        return;
      }

      for (const n of candidates) {
        g[best] = n;
        solve();
        g[best] = 0;
        if (count >= limit) return;
      }
    };

    solve();
    return count;
  };

  const generatePuzzle = (level) => {
    const activeCfg = CONFIGS[level];
    const boardSize = activeCfg.size;
    const rCount = activeCfg.boxRows;
    const cCount = activeCfg.boxCols;

    let rand = Math.random;
    if (level === 'daily') {
      const todayStr = new Date().toISOString().split('T')[0];
      const seedNum = parseInt(todayStr.replace(/-/g, ''), 10);
      rand = mulberry32(seedNum);
    }

    const shuffle = (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const buildSolvedBoard = () => {
      const nums = shuffle(Array.from({ length: boardSize }, (_, i) => i + 1));
      const board = Array(boardSize * boardSize).fill(0);

      const fill = (idx) => {
        if (idx === boardSize * boardSize) return true;
        const r = Math.floor(idx / boardSize);
        const c = idx % boardSize;
        const shuffledNums = shuffle(nums);

        for (const n of shuffledNums) {
          let valid = true;
          for (let i = 0; i < boardSize; i++) {
            if (board[r * boardSize + i] === n || board[i * boardSize + c] === n) {
              valid = false;
              break;
            }
          }
          if (valid) {
            const br = Math.floor(r / rCount) * rCount;
            const bc = Math.floor(c / cCount) * cCount;
            for (let rr = br; rr < br + rCount; rr++) {
              for (let cc = bc; cc < bc + cCount; cc++) {
                if (board[rr * boardSize + cc] === n) {
                  valid = false;
                  break;
                }
              }
              if (!valid) break;
            }
          }

          if (valid) {
            board[idx] = n;
            if (fill(idx + 1)) return true;
            board[idx] = 0;
          }
        }
        return false;
      };

      fill(0);
      return board;
    };

    const newSolution = buildSolvedBoard();
    const newPuzzle = [...newSolution];
    const target = activeCfg.clues;
    const totalCells = boardSize * boardSize;
    const order = shuffle([...Array(totalCells).keys()]);
    let clues = totalCells;

    for (const idx of order) {
      if (clues <= target) break;
      const backup = newPuzzle[idx];
      newPuzzle[idx] = 0;
      if (countSolutions(newPuzzle, boardSize, rCount, cCount, 2) !== 1) {
        newPuzzle[idx] = backup;
      } else {
        clues--;
      }
    }

    setConfigKey(level);
    setSolution(newSolution);
    setPuzzle(newPuzzle);
    setGrid([...newPuzzle]);
    setNotes(Array.from({ length: totalCells }, () => new Set()));
    setSelected(newPuzzle.findIndex(v => v === 0));
    setMistakes(0);
    setCompleted(false);
    setShowModal(false);
    setElapsed(0);
    setMessage({ text: '', type: '' });
  };

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!completed) {
        setElapsed(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [completed]);

  useEffect(() => {
    generatePuzzle('daily');
  }, []);

  const formatTime = (secs = elapsed) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const cellHasPeer = (idx, sel) => {
    if (sel < 0) return false;
    const r1 = Math.floor(idx / size), c1 = idx % size;
    const r2 = Math.floor(sel / size), c2 = sel % size;
    return r1 === r2 || c1 === c2 ||
      (Math.floor(r1 / boxRows) === Math.floor(r2 / boxRows) && Math.floor(c1 / boxCols) === Math.floor(c2 / boxCols));
  };

  const clearPeerNotes = (idx, n, currentNotes) => {
    const r = Math.floor(idx / size), c = idx % size;
    return currentNotes.map((noteSet, i) => {
      const rr = Math.floor(i / size), cc = i % size;
      const peer = rr === r || cc === c ||
        (Math.floor(rr / boxRows) === Math.floor(r / boxRows) && Math.floor(cc / boxCols) === Math.floor(c / boxCols));
      if (peer && noteSet.has(n)) {
        const copy = new Set(noteSet);
        copy.delete(n);
        return copy;
      }
      return noteSet;
    });
  };

  const handleGameComplete = () => {
    setCompleted(true);
    if (configKey === 'daily') {
      const newPlayed = stats.played + 1;
      const newStreak = stats.streak + 1;
      const newBest = stats.bestTime === null ? elapsed : Math.min(stats.bestTime, elapsed);
      const updated = { played: newPlayed, streak: newStreak, bestTime: newBest };
      setStats(updated);
      localStorage.setItem('skeedoku_daily_stats', JSON.stringify(updated));
    }
    setShowModal(true);
  };

  const enterNumber = (n) => {
    if (n > size || selected < 0 || puzzle[selected] || completed) return;

    if (notesMode) {
      if (grid[selected]) return;
      setNotes(prev => {
        const nextNotes = [...prev];
        const cellNotes = new Set(nextNotes[selected]);
        if (cellNotes.has(n)) cellNotes.delete(n);
        else cellNotes.add(n);
        nextNotes[selected] = cellNotes;
        return nextNotes;
      });
    } else {
      const nextGrid = [...grid];
      nextGrid[selected] = n;
      setGrid(nextGrid);

      setNotes(prev => {
        const nextNotes = [...prev];
        nextNotes[selected] = new Set();
        return nextNotes;
      });

      if (n !== solution[selected]) {
        setMistakes(m => m + 1);
        setMessage({ text: 'That number does not belong there.', type: 'bad' });
      } else {
        setNotes(prev => clearPeerNotes(selected, n, prev));
        setMessage({ text: '', type: '' });
      }
      checkComplete(nextGrid);
    }
  };

  const erase = () => {
    if (selected < 0 || puzzle[selected] || completed) return;
    const nextGrid = [...grid];
    nextGrid[selected] = 0;
    setGrid(nextGrid);
    setNotes(prev => {
      const nextNotes = [...prev];
      nextNotes[selected] = new Set();
      return nextNotes;
    });
    setMessage({ text: '', type: '' });
  };

  const checkComplete = (currentGrid) => {
    if (currentGrid.every((v, i) => v === solution[i])) {
      handleGameComplete();
      setMessage({ text: `Solved in ${formatTime()} with ${mistakes} mistake${mistakes === 1 ? '' : 's'}!`, type: 'good' });
    }
  };

  const giveHint = () => {
    if (completed) return;
    const totalCells = size * size;
    let idx = selected;
    if (idx < 0 || puzzle[idx] || grid[idx] === solution[idx]) {
      const candidates = [...Array(totalCells).keys()].filter(i => !puzzle[i] && grid[i] !== solution[i]);
      if (!candidates.length) return;
      idx = candidates[Math.floor(Math.random() * candidates.length)];
    }
    const nextGrid = [...grid];
    nextGrid[idx] = solution[idx];
    setGrid(nextGrid);
    setNotes(prev => {
      let nextNotes = [...prev];
      nextNotes[idx] = new Set();
      return clearPeerNotes(idx, solution[idx], nextNotes);
    });
    setSelected(idx);
    setMessage({ text: 'Hint placed.', type: 'good' });
    checkComplete(nextGrid);
  };

  const checkBoard = () => {
    const wrong = grid.some((v, i) => v && v !== solution[i]);
    const blanks = grid.some(v => !v);
    if (wrong) setMessage({ text: 'There are still incorrect entries.', type: 'bad' });
    else if (blanks) setMessage({ text: 'Everything filled so far is correct.', type: 'good' });
    else checkComplete(grid);
  };

  const resetGame = () => {
    setGrid([...puzzle]);
    setNotes(Array.from({ length: size * size }, () => new Set()));
    setMistakes(0);
    setElapsed(0);
    setCompleted(false);
    setShowModal(false);
    setSelected(puzzle.findIndex(v => v === 0));
    setMessage({ text: 'Puzzle reset.', type: '' });
  };

  const moveSelection = (dr, dc) => {
    let sel = selected < 0 ? 0 : selected;
    let r = Math.floor(sel / size), c = sel % size;
    r = Math.max(0, Math.min(size - 1, r + dr));
    c = Math.max(0, Math.min(size - 1, c + dc));
    setSelected(r * size + c);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key >= '1' && e.key <= String(size)) enterNumber(Number(e.key));
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') erase();
      else if (e.key.toLowerCase() === 'n') setNotesMode(m => !m);
      else if (e.key.toLowerCase() === 'h') giveHint();
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1, 0); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1, 0); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); moveSelection(0, -1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); moveSelection(0, 1); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected, notesMode, grid, puzzle, completed, solution, mistakes, size]);

  const selectedValue = selected >= 0 ? grid[selected] : 0;
  const activeNums = Array.from({ length: size }, (_, i) => i + 1);

  return (
    <>
    <Navbar />
    <div className="sudoku-app-wrapper">
      <div className="app">
        <section className="card game-card">
          <div className="topbar">
            <h1>Skeedoku {size === 4 ? '(4x4)' : size === 6 ? '(6x6)' : ''}</h1>
            <div className="meta">
              <label className="notes-toggle" title="Toggle notes mode">
                <span>Notes</span>
                <input 
                  type="checkbox" 
                  checked={notesMode} 
                  onChange={(e) => setNotesMode(e.target.checked)} 
                  aria-label="Notes mode" 
                />
                <span className="switch" aria-hidden="true"></span>
              </label>
              <span className="pill">{cfg.label}</span>
              <span className="pill">{formatTime()}</span>
            </div>
          </div>

          <div 
            className={`sudoku-board size-${size}`} 
            aria-label="Skeedoku board" 
            style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {grid.map((val, i) => {
              const r = Math.floor(i / size);
              const c = i % size;
              const isGiven = puzzle[i] !== 0;
              const isSelected = i === selected;
              const isRelated = cellHasPeer(i, selected);
              const isSame = selectedValue && val === selectedValue && !isSelected;
              const isError = val && !isGiven && val !== solution[i];

              let classNames = ['cell'];
              if (isGiven) classNames.push('given');
              if (isSelected) classNames.push('selected');
              else if (isRelated) classNames.push('related');
              if (isSame) classNames.push('same');
              if (isError) classNames.push('error');

              return (
                <button
                  key={i}
                  className={classNames.join(' ')}
                  data-row={r}
                  data-col={c}
                  aria-label={`Row ${r + 1}, column ${c + 1}`}
                  onClick={() => setSelected(i)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setSelected(i);
                    setNotesMode(m => !m);
                  }}
                >
                  {val ? val : (
                    notes[i] && notes[i].size > 0 ? (
                      <div className={`notes size-${size}`}>
                        {activeNums.map(n => (
                          <span key={n} className="note">
                            {notes[i].has(n) ? n : ''}
                          </span>
                        ))}
                      </div>
                    ) : null
                  )}
                </button>
              );
            })}
          </div>

          <div className="number-pad">
            {activeNums.map(n => {
              const isCountComplete = grid.filter(v => v === n).length === size;
              return (
                <button 
                  key={n} 
                  className={`btn num ${isCountComplete ? 'completed-num' : ''}`} 
                  onClick={() => enterNumber(n)}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <div className="controls">
            <button className="btn" onClick={erase}>Erase</button>
            <button className="btn" onClick={giveHint}>Hint</button>
            <button className="btn" onClick={checkBoard}>Check</button>
            <button className="btn danger" onClick={resetGame}>Reset</button>
          </div>

          <div className={`message ${message.type}`}>{message.text}</div>
        </section>

        <aside className="card side-card">
          <p className="section-title">New game</p>
          <div className="setup">
            <div className="field">
              <label htmlFor="difficulty-select">Difficulty</label>
              <select 
                id="difficulty-select" 
                value={configKey} 
                onChange={(e) => generatePuzzle(e.target.value)}
              >
                <option value="daily">Daily Puzzle</option>
                <option value="4x4">4x4 Mini</option>
                <option value="6x6">6x6 Mini (2x3)</option>
                <option value="easy">Easy (9x9)</option>
                <option value="medium">Medium (9x9)</option>
                <option value="hard">Hard (9x9)</option>
                <option value="expert">Expert (9x9)</option>
              </select>
            </div>
            {configKey !== 'daily' && (
              <button className="btn primary" onClick={() => generatePuzzle(configKey)}>New puzzle</button>
            )}
          </div>

          <div className="stats">
            <div className="stat">
              <small>Filled</small>
              <strong>{grid.filter(Boolean).length} / {size * size}</strong>
            </div>
            <div className="stat">
              <small>Mistakes</small>
              <strong>{mistakes}</strong>
            </div>
          </div>

          <p className="section-title">How to play</p>
          <div className="help">
            Select a square, then press a number or use your keyboard. Toggle
            <strong>Notes</strong> to add pencil marks, or right-click any cell. Arrow keys move the selection.
            <br /><br />
            Shortcuts: <kbd>1</kbd>–<kbd>{size}</kbd>, <kbd>Backspace</kbd>, <kbd>N</kbd> or <kbd>Right Click</kbd> for notes,
            <kbd>H</kbd> for hint.
          </div>
        </aside>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="card modal-content">
            <h2>Puzzle Completed! 🎉</h2>
            <p className="modal-subtitle">{configKey === 'daily' ? 'Daily Challenge Stats' : 'Great job solving this puzzle!'}</p>
            
            <div className="modal-stats">
              <div className="stat">
                <small>Time</small>
                <strong>{formatTime()}</strong>
              </div>
              <div className="stat">
                <small>Mistakes</small>
                <strong>{mistakes}</strong>
              </div>
              {configKey === 'daily' && (
                <>
                  <div className="stat">
                    <small>Streak</small>
                    <strong>{stats.streak}</strong>
                  </div>
                  <div className="stat">
                    <small>Best Time</small>
                    <strong>{stats.bestTime !== null ? formatTime(stats.bestTime) : '-'}</strong>
                  </div>
                </>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn primary" onClick={() => setShowModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}