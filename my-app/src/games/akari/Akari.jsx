import { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '../../components/Navbar';
import DailyResults from '../../components/DailyResults';
import { useDailyDate } from '../../components/DailyBoundary';
import { readLocal, writeLocal } from '../../utils/dailyStats.js';
import { dailyPuzzle, evaluateBoard, generatePuzzle } from './puzzle.js';
import './Akari.css';

const saveKey = date => `akari-daily-v1:${date}`;

export function restoreProgress(puzzle, saved) {
  const empty = { bulbs: [], marks: [], seconds: 0, started: false };
  const validCells = list => Array.isArray(list) && new Set(list).size === list.length
    && list.every(id => Number.isInteger(id) && id >= 0 && id < puzzle.cells.length && puzzle.cells[id] === null);
  if (!saved || saved.fingerprint !== JSON.stringify(puzzle) || !validCells(saved.bulbs) || !validCells(saved.marks)
    || saved.bulbs.some(id => saved.marks.includes(id))) return empty;
  return { bulbs: saved.bulbs, marks: saved.marks,
    seconds: Number.isInteger(saved.seconds) && saved.seconds >= 0 ? saved.seconds : 0,
    started: !!saved.started || saved.bulbs.length > 0 || saved.marks.length > 0 };
}

function newGame(date, mode = 'daily', size = 7) {
  const puzzle = mode === 'daily' ? dailyPuzzle(date) : generatePuzzle(size, `practice:${Math.random()}`);
  const progress = restoreProgress(puzzle, mode === 'daily' ? readLocal(saveKey(date), null) : null);
  return { puzzle, mode, ...progress, past: [], future: [] };
}

function Bulb() {
  return <svg viewBox="0 0 32 40" aria-hidden="true" focusable="false">
    <path d="M10 28C10 23 4 22 4 14a12 12 0 0 1 24 0c0 8-6 9-6 14Z" fill="#ffd14e" stroke="currentColor" strokeWidth="2.5" />
    <path d="M11 29h10m-10 5h10m-8 4h6M16 27V16m-4-3 4 3 4-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>;
}

export default function Akari() {
  const date = useDailyDate();
  const [game, setGame] = useState(() => newGame(date));
  const [tool, setTool] = useState('bulb');
  const [practiceSize, setPracticeSize] = useState(7);
  const boardRef = useRef(null);
  const { puzzle, bulbs, marks } = game;
  const status = useMemo(() => evaluateBoard(puzzle, bulbs), [puzzle, bulbs]);
  const { won, lit, conflicts, clues, whiteCount } = status;

  useEffect(() => {
    if (!game.started || won) return;
    const timer = setInterval(() => setGame(current => ({ ...current, seconds: current.seconds + 1 })), 1000);
    return () => clearInterval(timer);
  }, [game.started, won]);

  useEffect(() => {
    if (game.mode === 'daily') writeLocal(saveKey(date), {
      fingerprint: JSON.stringify(puzzle), bulbs, marks, seconds: game.seconds, started: game.started,
    });
  }, [date, game.mode, game.seconds, game.started, puzzle, bulbs, marks]);

  function changeMode(mode, size = practiceSize) {
    setGame(newGame(date, mode, size));
    setTool('bulb');
  }

  function commit(nextBulbs, nextMarks) {
    setGame(current => ({ ...current, bulbs: nextBulbs, marks: nextMarks, started: true,
      past: [...current.past, { bulbs: current.bulbs, marks: current.marks }], future: [] }));
  }

  function toggle(id, selectedTool = tool) {
    if (won || puzzle.cells[id] !== null) return;
    const nextBulbs = bulbs.filter(cell => cell !== id), nextMarks = marks.filter(cell => cell !== id);
    if (selectedTool === 'bulb' && !bulbs.includes(id)) nextBulbs.push(id);
    if (selectedTool === 'mark' && !marks.includes(id)) nextMarks.push(id);
    commit(nextBulbs, nextMarks);
  }

  function travel(direction) {
    setGame(current => {
      const from = direction === 'undo' ? 'past' : 'future';
      const to = direction === 'undo' ? 'future' : 'past';
      if (!current[from].length) return current;
      return { ...current, ...current[from].at(-1), [from]: current[from].slice(0, -1),
        [to]: [...current[to], { bulbs: current.bulbs, marks: current.marks }] };
    });
  }

  function handleKey(event, id) {
    const key = event.key.toLowerCase();
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (['b', 'x', 'backspace', 'delete'].includes(key)) {
      event.preventDefault(); toggle(id, key === 'b' ? 'bulb' : key === 'x' ? 'mark' : 'erase');
    }
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -puzzle.size, ArrowDown: puzzle.size }[event.key];
    if (!delta) return;
    event.preventDefault();
    let next = id + delta;
    while (next >= 0 && next < puzzle.cells.length) {
      if (Math.abs(delta) === 1 && Math.floor(next / puzzle.size) !== Math.floor(id / puzzle.size)) break;
      if (puzzle.cells[next] === null) { boardRef.current?.querySelector(`[data-cell="${next}"]`)?.focus(); break; }
      next += delta;
    }
  }

  return <main className="akari-page">
    <Navbar />
    <header className="akari-heading"><p className="akari-eyebrow">LIGHT UP</p><h1>Akari</h1><p>A little light goes a long way.</p></header>
    <DailyResults gameId="akari" title="Akari" daily={game.mode === 'daily'} date={date} finished={won} seconds={game.seconds} started={game.started} />
    <div className="akari-controls">
      <button aria-pressed={game.mode === 'daily'} onClick={() => changeMode('daily')}>Daily</button>
      <button aria-pressed={game.mode === 'practice'} onClick={() => changeMode('practice')}>Practice</button>
      {game.mode === 'practice' && <>
        <select aria-label="Practice board size" value={practiceSize} onChange={event => { const size = Number(event.target.value); setPracticeSize(size); changeMode('practice', size); }}>
          {[5, 7, 9].map(size => <option key={size} value={size}>{size} × {size}</option>)}
        </select>
        <button onClick={() => changeMode('practice')}>New puzzle</button>
      </>}
    </div>
    <p className="akari-date">{game.mode === 'daily' ? `${date} · Daily` : 'Practice'} · {puzzle.size} × {puzzle.size}</p>
    <section className="akari-panel" aria-label="Akari puzzle">
      <div className="akari-progress"><span><strong>{lit.size}</strong> / {whiteCount} lit</span><span>{Math.floor(game.seconds / 60)}:{String(game.seconds % 60).padStart(2, '0')}</span></div>
      <div className="akari-board" ref={boardRef} style={{ '--size': puzzle.size }} aria-label="Light Up board">
        {puzzle.cells.map((cell, id) => {
          const position = `Row ${Math.floor(id / puzzle.size) + 1}, column ${id % puzzle.size + 1}`;
          if (cell !== null) return <div key={id} className={`akari-wall ${clues[id] || ''}`} aria-label={`${position}, ${cell < 0 ? 'wall' : `wall requiring ${cell} adjacent bulbs, ${clues[id]}`}`}>
            {cell >= 0 ? cell : ''}
          </div>;
          const bulb = bulbs.includes(id), mark = marks.includes(id), conflict = conflicts.has(id);
          return <button key={id} data-cell={id} className={`akari-cell${lit.has(id) ? ' lit' : ''}${conflict ? ' conflict' : ''}`}
            aria-label={`${position}, ${bulb ? 'bulb' : mark ? 'marked empty' : 'empty'}, ${lit.has(id) ? 'lit' : 'unlit'}${conflict ? ', bulb conflict' : ''}`}
            aria-pressed={bulb} onClick={event => toggle(id, event.shiftKey ? 'mark' : tool)}
            onContextMenu={event => { event.preventDefault(); toggle(id, 'mark'); }} onKeyDown={event => handleKey(event, id)}>
            {bulb ? <Bulb /> : mark ? <span aria-hidden="true">×</span> : null}
          </button>;
        })}
      </div>
      <div className="akari-controls akari-tools" aria-label="Board tools">
        <button aria-pressed={tool === 'bulb'} onClick={() => setTool('bulb')}>Bulb</button>
        <button aria-pressed={tool === 'mark'} onClick={() => setTool('mark')}>Mark ×</button>
        <button aria-pressed={tool === 'erase'} onClick={() => setTool('erase')}>Erase</button>
        <button disabled={!game.past.length} onClick={() => travel('undo')}>Undo</button>
        <button disabled={!game.future.length} onClick={() => travel('redo')}>Redo</button>
        <button disabled={!bulbs.length && !marks.length} onClick={() => commit([], [])}>Reset</button>
      </div>
      <p className={`akari-message${won ? ' won' : ''}`} role="status">{won ? 'Brilliant! Every square is lit.' : conflicts.size ? 'These bulbs shine on each other. Remove one of the red bulbs.' : Object.values(clues).includes('over') ? 'A numbered wall has too many adjacent bulbs.' : 'Light every white square. Bulbs must not shine on each other.'}</p>
    </section>
    <p className="akari-help">Tap a square to place a bulb. Use Mark × for notes, or right-click.<br />Arrow keys move between squares · B bulb · X mark · Delete erase</p>
  </main>;
}
