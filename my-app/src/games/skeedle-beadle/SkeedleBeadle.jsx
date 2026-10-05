import { useEffect, useMemo, useState } from 'react';
import Navbar from '../../components/Navbar';
import DailyResults from '../../components/DailyResults';
import { useDailyDate, useArchive } from '../../components/DailyBoundary';
import { readLocal, writeLocal, formatDuration } from '../../utils/dailyStats.js';
import { puzzleSnapshot } from '../../utils/archive.js';
import { CAPACITY, LEVELS, dailyPuzzle, generatePuzzle, isSolved, isSolvedStick, slide, slideProblem, solve, topRun } from './puzzle.js';
import { restoreBeadle, saveBeadle, beadleSaveKey, HISTORY_LIMIT } from './progress.js';
import { BEADS, beadDefs, beadMarkup } from './beads.js';
import './SkeedleBeadle.css';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

// Bead artwork comes from beads.js (shared with the homepage card). The
// markup is built only from fixed shapes and colors, never from user input.
const DEFS = beadDefs();
function Bead({ color }) {
  return <svg className="beadle-bead-shape" viewBox="0 0 40 40" aria-hidden="true" focusable="false"
    dangerouslySetInnerHTML={{ __html: beadMarkup(color) }} />;
}

function newGame(date, mode, level, archive) {
  const puzzle = mode === 'daily'
    // v2: even stick counts (6/8/10 bead types). Bump this when the generator
    // changes before launch so browsers drop puzzles saved by an older version.
    ? puzzleSnapshot('skeedle-beadle-v2', date, () => dailyPuzzle(date))
    : generatePuzzle(level, `practice:${Math.random()}`);
  const progress = restoreBeadle(puzzle, mode === 'daily' ? readLocal(beadleSaveKey(date, archive), null) : null);
  return { puzzle, mode, ...progress };
}

export default function SkeedleBeadle() {
  const date = useDailyDate();
  const archive = !!useArchive()?.archive;
  const [game, setGame] = useState(() => newGame(date, 'daily', 2, archive));
  const [practiceLevel, setPracticeLevel] = useState(2);
  const [selected, setSelected] = useState(null);
  const [hint, setHint] = useState(null);
  const [message, setMessage] = useState('');
  const [shake, setShake] = useState(null);
  const [lastSlide, setLastSlide] = useState(null);
  const { puzzle, sticks } = game;
  const won = useMemo(() => isSolved(sticks), [sticks]);
  const stuck = useMemo(() => !won && !sticks.some((_, from) => sticks.some((__, to) => !slideProblem(sticks, from, to))), [sticks, won]);
  const config = LEVELS[puzzle.level];

  useEffect(() => {
    if (!game.started || won) return;
    const timer = setInterval(() => setGame(current => ({ ...current, seconds: current.seconds + 1 })), 1000);
    return () => clearInterval(timer);
  }, [game.started, won]);

  useEffect(() => {
    if (game.mode === 'daily') writeLocal(beadleSaveKey(date, archive), saveBeadle(puzzle, game));
  }, [date, archive, puzzle, game]);

  function reset(next) {
    setGame(next); setSelected(null); setHint(null); setMessage(''); setLastSlide(null);
  }
  const changeMode = (mode, level = practiceLevel) => reset(newGame(date, mode, level, archive));

  function choose(index) {
    if (won) return;
    setHint(null);
    if (selected === null) {
      if (!sticks[index].length) { setMessage('That stick is empty. Pick a stick with beads to move.'); return; }
      if (isSolvedStick(sticks[index])) { setMessage('That stick is already finished.'); return; }
      setSelected(index); setMessage(''); return;
    }
    if (selected === index) { setSelected(null); return; }
    const problem = slideProblem(sticks, selected, index);
    if (problem) {
      if (problem === 'color' || problem === 'full') {
        setShake({ index, key: Date.now() });
        setMessage(problem === 'full' ? 'That stick is full.' : 'Beads only go onto the same bead or an empty stick.');
      }
      return;
    }
    const result = slide(sticks, selected, index);
    setGame(current => ({
      ...current, sticks: result.sticks, moves: current.moves + 1, started: true,
      history: [...current.history, { sticks: current.sticks, moves: current.moves }].slice(-HISTORY_LIMIT),
    }));
    setLastSlide({ index, amount: result.amount, key: game.moves + 1 });
    setSelected(null); setMessage('');
  }

  function undo() {
    if (!game.history.length) return;
    setGame(current => {
      const previous = current.history.at(-1);
      return { ...current, sticks: previous.sticks, moves: previous.moves, history: current.history.slice(0, -1) };
    });
    setSelected(null); setHint(null); setLastSlide(null); setMessage('');
  }

  function restart() {
    if (!game.moves) return;
    setGame(current => ({ ...current, sticks: puzzle.sticks.map(stick => stick.slice()), moves: 0,
      history: [...current.history, { sticks: current.sticks, moves: current.moves }].slice(-HISTORY_LIMIT) }));
    setSelected(null); setHint(null); setLastSlide(null); setMessage('Back to the start. Undo brings your last position back.');
  }

  function showHint() {
    if (won) return;
    const path = solve(sticks, { maxStates: 60000 });
    if (!path) { setHint(null); setMessage('There is no way forward from here. Undo a few moves and try another route.'); return; }
    setHint(path[0]); setSelected(null);
    setGame(current => ({ ...current, hints: current.hints + 1, started: true }));
    setMessage(`Try moving the glowing stick's top beads onto the stick with the dashed outline. About ${path.length} moves to go from here.`);
  }

  useEffect(() => {
    function onKey(event) {
      if (event.ctrlKey || event.metaKey || event.altKey || /input|select|textarea/i.test(event.target?.tagName)) return;
      const index = KEYS.indexOf(event.key);
      if (index >= 0 && index < sticks.length) { event.preventDefault(); choose(index); }
      else if (event.key === 'Escape') setSelected(null);
      else if (event.key.toLowerCase() === 'u' || event.key === 'Backspace') { event.preventDefault(); undo(); }
      else if (event.key.toLowerCase() === 'h') showHint();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Always two even rows: every level has an even number of sticks.
  const columns = Math.ceil(sticks.length / 2);
  const status = won ? `Sorted in ${game.moves} moves${game.moves <= puzzle.par ? ` — at or under par (${puzzle.par})!` : ` (par ${puzzle.par}).`}${game.hints ? ` Hints used: ${game.hints}.` : ''}`
    : stuck ? 'No moves left. Undo or restart to find another route.'
    : message || (selected !== null ? 'Beads picked up. Choose where to slide them.' : 'Pick a stick, then the stick to slide its top beads onto.');

  return <main className="beadle-page">
    <Navbar />
    <header className="beadle-heading"><p className="beadle-eyebrow">BEAD SORT</p><h1>Skeedle Beadle</h1><p>Every shape on its own stick.</p></header>
    <DailyResults gameId="skeedle-beadle" title="Skeedle Beadle" daily={game.mode === 'daily'} date={date} finished={won} seconds={game.seconds} started={game.started} />
    <div className="beadle-controls">
      <button aria-pressed={game.mode === 'daily'} onClick={() => changeMode('daily')}>{archive ? 'Archive puzzle' : 'Daily'}</button>
      <button aria-pressed={game.mode === 'practice'} onClick={() => changeMode('practice')}>Practice</button>
      {game.mode === 'practice' && <>
        <select aria-label="Practice difficulty" value={practiceLevel} onChange={event => { const level = Number(event.target.value); setPracticeLevel(level); changeMode('practice', level); }}>
          {[1, 2, 3].map(level => <option key={level} value={level}>{LEVELS[level].label} · {LEVELS[level].colors} bead types</option>)}
        </select>
        <button onClick={() => changeMode('practice')}>New puzzle</button>
      </>}
    </div>
    <p className="beadle-date">{game.mode === 'daily' ? `${date} · ${archive ? 'Archive' : 'Daily'}` : 'Practice'} · {config.label} · {config.colors} bead types</p>
    <section className="beadle-panel" aria-label="Skeedle Beadle puzzle">
      <div className="beadle-progress">
        <span>Moves <strong>{game.moves}</strong> · Par {puzzle.par}</span>
        <span>{formatDuration(game.seconds)}</span>
      </div>
      <svg className="beadle-defs" aria-hidden="true" focusable="false"><defs dangerouslySetInnerHTML={{ __html: DEFS }} /></svg>
      <div className={`beadle-rack${won ? ' won' : ''}`} style={{ '--columns': columns, '--capacity': CAPACITY }}>
        {sticks.map((stick, index) => {
          const run = topRun(stick);
          const lifted = selected === index;
          const done = isSolvedStick(stick) && stick.length > 0;
          const label = `Stick ${index + 1}${index < KEYS.length ? ` (key ${KEYS[index]})` : ''}: ${stick.length ? stick.map(color => BEADS[color].name).join(', ') + ' from bottom to top' : 'empty'}${done ? ', finished' : ''}${lifted ? ', picked up' : ''}`;
          const hinted = hint && (hint[0] === index ? ' hint-from' : hint[1] === index ? ' hint-to' : '');
          return <button key={index} type="button" aria-label={label} aria-pressed={lifted}
            className={`beadle-stick${lifted ? ' selected' : ''}${done ? ' done' : ''}${hinted || ''}${shake?.index === index ? ' shake' : ''}`}
            onAnimationEnd={() => setShake(null)} onClick={() => choose(index)}>
            <span className="beadle-post">
              <span className="beadle-rod" aria-hidden="true" />
              <span className="beadle-beads">
                {stick.map((color, position) => {
                  const fresh = lastSlide?.index === index && position >= stick.length - lastSlide.amount;
                  return <span key={fresh ? `${position}-${lastSlide.key}` : position}
                    className={`beadle-bead${lifted && position >= stick.length - run ? ' rising' : ''}${fresh ? ' fresh' : ''}`}><Bead color={color} /></span>;
                })}
              </span>
              <span className="beadle-base" aria-hidden="true" />
            </span>
          </button>;
        })}
      </div>
      <div className="beadle-controls beadle-tools">
        <button disabled={!game.history.length || won} onClick={undo}>Undo</button>
        <button disabled={!game.moves || won} onClick={restart}>Restart</button>
        <button disabled={won} onClick={showHint}>Hint</button>
      </div>
      <p className={`beadle-message${won ? ' won' : stuck ? ' stuck' : ''}`} role="status">{status}</p>
    </section>
    <p className="beadle-help">Tap a stick to pick up its top beads, then tap where to slide them. Beads go onto the same shape or an empty stick.<br />Number keys pick sticks left to right, top row first (0, − and = for 10–12) · U undo · H hint · Esc cancel</p>
  </main>;
}
