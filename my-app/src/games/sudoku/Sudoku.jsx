import React, { useState, useEffect, useRef } from 'react';
import './Sudoku.css';

const CLUES = { easy: 42, medium: 35, hard: 29, expert: 25 };

export default function Sudoku() {
  const [solution, setSolution] = useState([]);
  const [puzzle, setPuzzle] = useState([]);
  const [grid, setGrid] = useState([]);
  const [notes, setNotes] = useState(Array.from({ length: 81 }, () => new Set()));
  const [selected, setSelected] = useState(-1);
  const [notesMode, setNotesMode] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [difficulty, setDifficulty] = useState('medium');
  const [difficultyLabel, setDifficultyLabel] = useState('Medium');
  const [message, setMessage] = useState({ text: '', type: '' });

  const timerRef = useRef(null);

  const pattern = (r, c) => (r * 3 + Math.floor(r / 3) + c) % 9;

  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const buildSolvedBoard = () => {
    const rows = shuffle([0, 1, 2]).flatMap(b => shuffle([0, 1, 2]).map(r => b * 3 + r));
    const cols = shuffle([0, 1, 2]).flatMap(b => shuffle([0, 1, 2]).map(c => b * 3 + c));
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    return rows.flatMap(r => cols.map(c => nums[pattern(r, c)]));
  };

  const countSolutions = (testGrid, limit = 2) => {
    const g = [...testGrid];
    let count = 0;

    const validAt = (idx, n) => {
      const r = Math.floor(idx / 9), c = idx % 9;
      for (let i = 0; i < 9; i++) {
        if (g[r * 9 + i] === n) return false;
        if (g[i * 9 + c] === n) return false;
      }
      const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (let rr = br; rr < br + 3; rr++)
        for (let cc = bc; cc < bc + 3; cc++)
          if (g[rr * 9 + cc] === n) return false;
      return true;
    };

    const solve = () => {
      if (count >= limit) return;
      let best = -1, candidates = null;

      for (let i = 0; i < 81; i++) {
        if (g[i] !== 0) continue;
        const opts = [];
        for (let n = 1; n <= 9; n++) if (validAt(i, n)) opts.push(n);
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
    const newSolution = buildSolvedBoard();
    const newPuzzle = [...newSolution];
    const target = CLUES[level];
    const order = shuffle([...Array(81).keys()]);
    let clues = 81;

    for (const idx of order) {
      if (clues <= target) break;
      const backup = newPuzzle[idx];
      newPuzzle[idx] = 0;
      if (countSolutions(newPuzzle, 2) !== 1) {
        newPuzzle[idx] = backup;
      } else {
        clues--;
      }
    }

    setSolution(newSolution);
    setPuzzle(newPuzzle);
    setGrid([...newPuzzle]);
    setNotes(Array.from({ length: 81 }, () => new Set()));
    setSelected(newPuzzle.findIndex(v => v === 0));
    setMistakes(0);
    setCompleted(false);
    setElapsed(0);
    
    const labels = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };
    setDifficultyLabel(labels[level] || 'Medium');
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
    generatePuzzle('medium');
  }, []);

  const formatTime = () => {
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const cellHasPeer = (idx, sel) => {
    if (sel < 0) return false;
    const r1 = Math.floor(idx / 9), c1 = idx % 9;
    const r2 = Math.floor(sel / 9), c2 = sel % 9;
    return r1 === r2 || c1 === c2 ||
      (Math.floor(r1 / 3) === Math.floor(r2 / 3) && Math.floor(c1 / 3) === Math.floor(c2 / 3));
  };

  const clearPeerNotes = (idx, n, currentNotes) => {
    const r = Math.floor(idx / 9), c = idx % 9;
    return currentNotes.map((noteSet, i) => {
      const rr = Math.floor(i / 9), cc = i % 9;
      const peer = rr === r || cc === c ||
        (Math.floor(rr / 3) === Math.floor(r / 3) && Math.floor(cc / 3) === Math.floor(c / 3));
      if (peer && noteSet.has(n)) {
        const copy = new Set(noteSet);
        copy.delete(n);
        return copy;
      }
      return noteSet;
    });
  };

  const enterNumber = (n) => {
    if (selected < 0 || puzzle[selected] || completed) return;

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
      setCompleted(true);
      setMessage({ text: `Solved in ${formatTime()} with ${mistakes} mistake${mistakes === 1 ? '' : 's'}!`, type: 'good' });
    }
  };

  const giveHint = () => {
    if (completed) return;
    let idx = selected;
    if (idx < 0 || puzzle[idx] || grid[idx] === solution[idx]) {
      const candidates = [...Array(81).keys()].filter(i => !puzzle[i] && grid[i] !== solution[i]);
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
    setNotes(Array.from({ length: 81 }, () => new Set()));
    setMistakes(0);
    setElapsed(0);
    setCompleted(false);
    setSelected(puzzle.findIndex(v => v === 0));
    setMessage({ text: 'Puzzle reset.', type: '' });
  };

  const moveSelection = (dr, dc) => {
    let sel = selected < 0 ? 0 : selected;
    let r = Math.floor(sel / 9), c = sel % 9;
    r = Math.max(0, Math.min(8, r + dr));
    c = Math.max(0, Math.min(8, c + dc));
    setSelected(r * 9 + c);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key >= '1' && e.key <= '9') enterNumber(Number(e.key));
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
  }, [selected, notesMode, grid, puzzle, completed, solution, mistakes]);

  const selectedValue = selected >= 0 ? grid[selected] : 0;

  return (
    <div className="sudoku-app-wrapper">
      <div className="app">
        <section className="card game-card">
          <div className="topbar">
            <h1>Sudoku</h1>
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
              <span className="pill">{difficultyLabel}</span>
              <span className="pill">{formatTime()}</span>
            </div>
          </div>

          <div className="sudoku-board" aria-label="Sudoku board" onContextMenu={(e) => e.preventDefault()}>
            {grid.map((val, i) => {
              const r = Math.floor(i / 9);
              const c = i % 9;
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
                      <div className="notes">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
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
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <button key={n} className="btn num" onClick={() => enterNumber(n)}>
                {n}
              </button>
            ))}
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
                value={difficulty} 
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="expert">Expert</option>
              </select>
            </div>
            <button className="btn primary" onClick={() => generatePuzzle(difficulty)}>Generate puzzle</button>
          </div>

          <div className="stats">
            <div className="stat">
              <small>Filled</small>
              <strong>{grid.filter(Boolean).length} / 81</strong>
            </div>
            <div className="stat">
              <small>Mistakes</small>
              <strong>{mistakes}</strong>
            </div>
          </div>

          <p className="section-title">How to play</p>
          <div className="help">
            Select a square, then press a number or use your keyboard. Toggle
            <strong>Notes</strong> to add pencil marks. Arrow keys move the selection.
            <br /><br />
            Shortcuts: <kbd>1</kbd>–<kbd>9</kbd>, <kbd>Backspace</kbd>, <kbd>N</kbd> for notes,
            <kbd>H</kbd> for hint.
          </div>
        </aside>
      </div>
    </div>
  );
}