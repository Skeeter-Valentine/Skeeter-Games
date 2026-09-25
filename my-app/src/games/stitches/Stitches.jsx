import DailyResults from '../../components/DailyResults';
import { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '../../components/Navbar';
import { checkSolution, dailyPuzzle, generatePuzzle, getCounts, getEdges } from './puzzle.js';
import './Stitches.css';

const COLORS = ['#ff2a85', '#00f0ff', '#ffb703', '#00ff87', '#b568ff', '#398cff', '#ff7538', '#ffff00', '#f251ff'];
const today = () => new Date().toISOString().slice(0, 10);
const storageKey = date => `stitches-daily-v2-${date}`;
const timeText = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

function newGame(mode, size = 7) {
  const date = today();
  const puzzle = mode === 'daily' ? dailyPuzzle(date) : generatePuzzle(size);
  const game = { mode, date, puzzle, selected: [], marks: [], seconds: 0, history: [] };
  if (mode === 'daily') {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(date)));
      const validIds = new Set(getEdges(puzzle.regions).map(edge => edge.id));
      if (saved && saved.fingerprint === JSON.stringify(puzzle)
        && Array.isArray(saved.selected) && saved.selected.every(id => validIds.has(id))
        && Array.isArray(saved.marks) && saved.marks.every(cell => Number.isInteger(cell) && cell >= 0 && cell < 49)) {
        game.selected = [...new Set(saved.selected)];
        game.marks = [...new Set(saved.marks)];
        game.seconds = Number.isInteger(saved.seconds) && saved.seconds >= 0 ? saved.seconds : 0;
      }
    } catch { /* Storage can be unavailable or contain an old, invalid save. */ }
  }
  return game;
}

export default function Stitches({ onWin }) {
  const [game, setGame] = useState(() => newGame('daily'));
  const [tool, setTool] = useState('stitch');
  const [message, setMessage] = useState('');
  const notified = useRef(false);
  const markDrag = useRef(null);
  const { puzzle, selected, marks } = game;
  const size = puzzle.regions.length;
  const edges = useMemo(() => getEdges(puzzle.regions), [puzzle]);
  const chosen = edges.filter(edge => selected.includes(edge.id));
  const counts = getCounts(size, chosen);
  const total = new Set(edges.map(edge => edge.pair)).size;
  const won = checkSolution(puzzle, selected);
  const holes = new Set(chosen.flatMap(edge => [edge.a, edge.b]));

  useEffect(() => {
    if (won) return;
    const timer = setInterval(() => setGame(current => ({ ...current, seconds: current.seconds + 1 })), 1000);
    return () => clearInterval(timer);
  }, [won]);

  useEffect(() => {
    if (game.mode !== 'daily') return;
    try {
      localStorage.setItem(storageKey(game.date), JSON.stringify({
        fingerprint: JSON.stringify(game.puzzle), selected: game.selected, marks: game.marks, seconds: game.seconds,
      }));
    } catch { /* Playing remains available without browser storage. */ }
  }, [game]);

  const changeGame = (mode, nextSize = size) => {
    markDrag.current = null;
    setGame(newGame(mode, nextSize));
    setMessage('');
    setTool('stitch');
    notified.current = false;
  };

  const commit = (nextSelected, nextMarks) => {
    setGame(current => ({ ...current, selected: nextSelected, marks: nextMarks,
      history: [...current.history, { selected: current.selected, marks: current.marks }],
    }));
    setMessage('');
    if (!notified.current && checkSolution(puzzle, nextSelected)) {
      notified.current = true;
      onWin?.();
    }
  };

  const toggleStitch = edge => {
    if (won) return;
    if (selected.includes(edge.id)) {
      commit(selected.filter(id => id !== edge.id), marks);
      return;
    }
    if (holes.has(edge.a) || holes.has(edge.b)) {
      setMessage('That hole already belongs to a stitch. Remove the old stitch first.');
      return;
    }
    if (chosen.some(other => other.pair === edge.pair)) {
      setMessage('These two blocks are already stitched together. Remove that stitch to move it.');
      return;
    }
    commit([...selected, edge.id], marks.filter(cell => cell !== edge.a && cell !== edge.b));
  };

  const toggleMark = cell => {
    if (won || holes.has(cell)) return;
    commit(selected, marks.includes(cell) ? marks.filter(value => value !== cell) : [...marks, cell]);
  };

  const boardPoint = event => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return null;
    const point = event.currentTarget.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    const x = local.x - 1, y = local.y - 1;
    return x >= 0 && y >= 0 && x < size && y < size ? { x, y } : null;
  };

  const paintMarks = point => {
    const drag = markDrag.current;
    if (!drag) return;
    if (!point) { drag.last = null; return; }
    const from = drag.last || point;
    // Sample the segment so quick movements do not skip intermediate cells.
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(point.x - from.x), Math.abs(point.y - from.y)) * 5));
    let changed = false;
    for (let i = 0; i <= steps; i++) {
      const c = Math.floor(from.x + (point.x - from.x) * i / steps);
      const r = Math.floor(from.y + (point.y - from.y) * i / steps);
      const cell = r * size + c;
      if (drag.holes.has(cell) || drag.marks.has(cell) === drag.mark) continue;
      if (drag.mark) drag.marks.add(cell);
      else drag.marks.delete(cell);
      changed = true;
    }
    drag.last = point;
    if (!changed) return;
    const nextMarks = [...drag.marks];
    setGame(current => current.puzzle !== drag.puzzle ? current : {
      ...current, marks: nextMarks,
      history: [...drag.history, drag.before],
    });
    setMessage('');
  };

  const startMarkDrag = event => {
    if (event.button !== 2 || won) return;
    event.preventDefault();
    const point = boardPoint(event);
    if (!point) return;
    const cell = Math.floor(point.y) * size + Math.floor(point.x);
    if (holes.has(cell)) return;
    markDrag.current = {
      pointerId: event.pointerId, puzzle, holes, mark: !marks.includes(cell),
      marks: new Set(marks), last: null, history: game.history,
      before: { selected, marks },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    paintMarks(point);
  };

  const endMarkDrag = event => {
    if (markDrag.current?.pointerId !== event.pointerId) return;
    markDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const keyboard = (event, action) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); }
  };
  const clueClass = (actual, target) => actual > target ? 'over' : actual === target ? 'met' : '';

  return (
    <>
      <Navbar />
      <DailyResults gameId="stitches" title="Skitches" daily={game.mode === 'daily'} date={game.date} finished={won} seconds={game.seconds} />
      <main className="stitches-page">
        <header className="stitches-heading">
          <h1>SKITCHES</h1>
          <p>One thread. Two holes. Every neighbor connected.</p>
        </header>

        <div className="stitches-toolbar">
          <div className="stitches-mode" aria-label="Game mode">
            <button aria-pressed={game.mode === 'daily'} onClick={() => changeGame('daily')}>Daily</button>
            <button aria-pressed={game.mode === 'random'} onClick={() => changeGame('random')}>Random</button>
          </div>
          {game.mode === 'random' ? <>
            <label className="stitches-size-control">Size <select value={size} onChange={event => changeGame('random', Number(event.target.value))}>
              {[5, 7, 9].map(n => <option key={n} value={n}>{n} × {n}</option>)}
            </select></label>
            <button onClick={() => changeGame('random')}>New puzzle</button>
          </> : <span className="stitches-date">{game.date} · 7 × 7</span>}
        </div>

        <section className="stitches-panel" aria-label="Skitches puzzle">
          <div className="stitches-progress">
            <span><strong>{chosen.length}</strong> / {total} connections</span>
            <span aria-label={`Elapsed time ${timeText(game.seconds)}`}>{timeText(game.seconds)}</span>
          </div>
          <svg className={`stitches-board tool-${tool}`} viewBox={`0 0 ${size + 1.25} ${size + 1.25}`}
            onContextMenu={event => event.preventDefault()}
            onPointerDown={startMarkDrag}
            onPointerMove={event => {
              if (markDrag.current?.pointerId !== event.pointerId) return;
              if (!(event.buttons & 2)) { endMarkDrag(event); return; }
              paintMarks(boardPoint(event));
            }}
            onPointerUp={endMarkDrag}
            onPointerCancel={endMarkDrag}
            onLostPointerCapture={() => { markDrag.current = null; }}
            aria-label={`${size} by ${size} Skitches board`}>
            <title>Connect neighboring blocks. Outside numbers count holes.</title>
            {puzzle.cols.map((clue, c) => <text key={`c${c}`} x={c + 1.5} y="0.55"
              className={`stitches-clue ${clueClass(counts.cols[c], clue)}`}
              aria-label={`Column ${c + 1}: ${counts.cols[c]} of ${clue} holes`}>{clue}</text>)}
            {puzzle.rows.map((clue, r) => <text key={`r${r}`} x="0.48" y={r + 1.55}
              className={`stitches-clue ${clueClass(counts.rows[r], clue)}`}
              aria-label={`Row ${r + 1}: ${counts.rows[r]} of ${clue} holes`}>{clue}</text>)}
            {puzzle.regions.flatMap((row, r) => row.map((block, c) => {
              const cell = r * size + c;
              return <g key={cell}>
                <rect x={c + 1} y={r + 1} width="1" height="1" fill={COLORS[block % COLORS.length]}
                  className="stitches-cell" role="button" tabIndex={tool === 'mark' && !won ? 0 : -1}
                  aria-label={`Row ${r + 1}, column ${c + 1}, block ${block + 1}${marks.includes(cell) ? ', marked empty' : ''}`}
                  aria-pressed={marks.includes(cell)}
                  onClick={() => { if (tool === 'mark') toggleMark(cell); }}
                  onKeyDown={event => keyboard(event, () => toggleMark(cell))} />
                {marks.includes(cell) && <text className="stitches-mark" x={c + 1.5} y={r + 1.54}>×</text>}
              </g>;
            }))}
            {puzzle.regions.flatMap((row, r) => row.map((block, c) => <g key={`border-${r}-${c}`}>
              {c < size - 1 && row[c + 1] !== block && <line className="stitches-boundary" x1={c + 2} x2={c + 2} y1={r + 1} y2={r + 2} />}
              {r < size - 1 && puzzle.regions[r + 1][c] !== block && <line className="stitches-boundary" x1={c + 1} x2={c + 2} y1={r + 2} y2={r + 2} />}
            </g>))}
            <rect className="stitches-outline" x="1" y="1" width={size} height={size} />
            {edges.map(edge => {
              const x1 = edge.a % size + 1.5, y1 = Math.floor(edge.a / size) + 1.5;
              const x2 = edge.b % size + 1.5, y2 = Math.floor(edge.b / size) + 1.5;
              const active = selected.includes(edge.id);
              const horizontal = y1 === y2;
              return <g key={edge.id} className={`stitches-edge ${active ? 'active' : ''}`}
                role="button" tabIndex={tool === 'stitch' && !won ? 0 : -1} aria-pressed={active}
                aria-label={`${active ? 'Remove' : 'Add'} stitch: row ${Math.floor(edge.a / size) + 1} column ${edge.a % size + 1} to row ${Math.floor(edge.b / size) + 1} column ${edge.b % size + 1}`}
                onClick={() => { if (tool === 'stitch') toggleStitch(edge); }}
                onKeyDown={event => keyboard(event, () => toggleStitch(edge))}>
                <rect className="stitches-hit" x={(x1 + x2) / 2 - (horizontal ? 0.28 : 0.38)}
                  y={(y1 + y2) / 2 - (horizontal ? 0.38 : 0.28)} width={horizontal ? 0.56 : 0.76} height={horizontal ? 0.76 : 0.56} rx="0.1" />
                <g className="stitches-thread">
                  <line className="stitches-thread-outline" x1={x1} y1={y1} x2={x2} y2={y2} />
                  <line x1={x1} y1={y1} x2={x2} y2={y2} />
                  <circle cx={x1} cy={y1} r="0.105" /><circle cx={x2} cy={y2} r="0.105" />
                </g>
              </g>;
            })}
          </svg>
          <div className="stitches-tools">
            <button aria-pressed={tool === 'stitch'} onClick={() => setTool('stitch')}>Stitch</button>
            <button aria-pressed={tool === 'mark'} onClick={() => setTool('mark')}>Mark empty ×</button>
            <span className="stitches-tool-divider" />
            <button disabled={!game.history.length || won} onClick={() => {
              const previous = game.history.at(-1);
              setGame(current => ({ ...current, ...previous, history: current.history.slice(0, -1) }));
              setMessage('');
            }}>Undo</button>
            <button onClick={() => {
              markDrag.current = null;
              setGame(current => ({ ...current, selected: [], marks: [], history: [], seconds: 0 }));
              notified.current = false;
              setMessage('');
            }}>Reset</button>
          </div>
          <div className={`stitches-message ${won ? 'won' : ''}`} role="status">
            {won ? `All stitched up! Solved in ${timeText(game.seconds)}.` : message || (tool === 'stitch'
              ? 'Tap a thick boundary between two cells to stitch. Tap again to remove.'
              : 'Tap cells to mark them empty. These pencil marks are optional.')}
          </div>
        </section>
        <details className="stitches-rules" open>
          <summary>How to play</summary>
          <ol>
            <li>Connect every pair of blocks sharing an edge with <strong>exactly one stitch</strong>.</li>
            <li>A stitch joins two neighboring cells across a thick block boundary. Each endpoint is a hole, and <strong>holes cannot be shared</strong>.</li>
            <li>Match the numbers outside the grid: they count <strong>holes</strong> in each row and column. Green means matched; pink means too many.</li>
          </ol>
          <p>Use Tab and Enter/Space to place stitches or marks. Right-click and drag to mark cells empty; start on an × to erase marks. Undo reverses the whole drag.</p>
        </details>
      </main>
    </>
  );
}
