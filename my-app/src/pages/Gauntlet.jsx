import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ChiliRating from '../components/ChiliRating';
import GameModal from '../components/GameModal';
import ColorblindToggle from '../components/ColorblindToggle';
import { COLORBLIND_GAMES } from '../components/colorblind.js';
import { gameInstructions } from '../components/gameInstructions.js';
import { GauntletBoundary } from '../components/DailyBoundary';
import { forgetLocal, readLocal, writeLocal } from '../utils/dailyStats.js';
import { puzzleLoggingEnabled, readGameRates } from '../services/puzzleResults.js';
import { publishPar, readPar, watchOwner } from '../services/gauntletPar.js';
import { BOARD_SIZE, boardEnabled, boardStanding, friendlyError, readBoard, readMyEntry, readMyRun, saveNickname, sendEvent, signOutPlayer, watchPlayer } from '../services/gauntletBoard.js';
import SignInDialog from '../components/SignInDialog';
import { fromServerRun, pauseRun, resumeRun, GAUNTLET_START, PAR_NAME, STORAGE_PREFIX, TEST_GAUNTLETS, addToHistory, remainingPenalty, gauntletLaunched, isTestDay, testDay, gauntletDay, gauntletOpensAt, paceVersusPar, parVerdict, validPar, averageSolveSeconds, currentGameSeconds, formatClock, gameTitle, hintPenalty,
  gauntletLineup, gauntletPuzzleDate, historySummary, newRun, recordResult, restoreRun, runTotal, shareText, startNextGame } from '../gauntlet/gauntlet.js';
import Akari from '../games/akari/Akari';
import SkeedleBeadle from '../games/skeedle-beadle/SkeedleBeadle';
import MapGame from '../games/map/Map';
import Parshle from '../games/parshle/Parshle';
import Stitches from '../games/stitches/Stitches';
import SkeedleMarathon from '../games/skeedle-marathon/SkeedleMarathon';
import Nonograms from '../games/nonograms/Nonograms';
import Skeedlemath from '../games/skeedlemath/Skeedlemath';
import Pipes from '../games/pipes/pipes';
import Shikaku from '../games/shikaku/shikaku';
import Quordle from '../games/quordle/Quordle';
import Word500 from '../games/word500/Word500';
import Minesweeper from '../games/minesweeper/Minesweeper';
import Game2048 from '../games/2048/Game2048';
import Hashi from '../games/hashi/Hashi';
import PepperPlacer from '../games/pepper-placer/PepperPlacer';
import GauntletCountdown from '../components/GauntletCountdown';
import './Gauntlet.css';

const COMPONENTS = { akari: Akari, 'skeedle-beadle': SkeedleBeadle, map: MapGame, parshle: Parshle, stitches: Stitches,
  'skeedle-marathon': SkeedleMarathon, nonograms: Nonograms, skeedlemath: Skeedlemath, pipes: Pipes, shikaku: Shikaku,
  quordle: Quordle, word500: Word500, minesweeper: Minesweeper, '2048': Game2048, hashi: Hashi, 'pepper-placer': PepperPlacer };
const runKey = date => `${STORAGE_PREFIX}${isTestDay(date) ? 'test-run' : 'run'}:${date}`;
const HISTORY_KEY = `${STORAGE_PREFIX}history`;
const statusLabel = { won: 'Solved', lost: 'Lost', 'gave-up': 'Gave up' };

const ahead = seconds => seconds < 0 ? `${formatClock(-seconds)} ahead of ${PAR_NAME}` : seconds > 0 ? `${formatClock(seconds)} behind ${PAR_NAME}` : `level with ${PAR_NAME}`;

// Average solve time for the current game and spice level: the built-in
// estimate at once, replaced by the community average when it loads.
function usePenalty(gameId, level) {
  const [penalty, setPenalty] = useState(null);
  useEffect(() => {
    if (!gameId) return;
    let active = true;
    setPenalty(averageSolveSeconds(gameId, level));
    if (puzzleLoggingEnabled) readGameRates(gameId).then(docs => { if (active) setPenalty(averageSolveSeconds(gameId, level, docs)); }).catch(() => {});
    return () => { active = false; };
  }, [gameId, level]);
  return penalty;
}

// On desktop every game plays inside the same fixed frame under the gauntlet
// bar (filling the rest of the window), scaled down if needed so the whole
// game fits. The frame never moves between games, so a screen recorder or
// stream can be cropped to it once. Phones keep the normal scrolling layout.
const UNSCALED_GAMES = ['map'];
const FIT_QUERY = '(min-width: 900px) and (min-height: 560px)';
// What each game zooms to fill the playing area: its board (word games keep
// their on-screen keyboard in view). Everything else in the game scales with
// it: titles and mode buttons above end up out of shot, and tools below sit
// just under the playing area. The playing area is the framing box: up to
// 980px wide, the full height of the frame.
const FOCUS = {
  akari: ['.akari-board'],
  'skeedle-beadle': ['.beadle-rack'],
  // Skitches draws in an SVG with empty margins: fit what's actually drawn.
  stitches: ['.stitches-board > *'],
  nonograms: ['.grid-layout'],
  pipes: ['.pipes-canvas'],
  shikaku: ['.shikaku-board-wrapper'],
  minesweeper: ['.ms-classic-window'],
  hashi: ['.hashi-canvas-wrapper'],
  'pepper-placer': ['.pp-board'],
  parshle: ['.parshle-board', '.parshle-keyboard'],
  skeedlemath: ['.word500-board', '.word500-keyboard'],
  word500: ['.word500-board', '.word500-keyboard'],
  quordle: ['.quordle-grid', '.keyboard'],
};
const MAX_ZOOM = 4, AREA_PADDING = 6;
// The visible extent of the focus elements, including anything that hangs
// outside them (such as guess-bonus pills), in the stage's own unscaled
// coordinates.
function focusBox(stage, selectors, scale) {
  const origin = stage.getBoundingClientRect();
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const element of selectors.flatMap(selector => [...stage.querySelectorAll(selector)])) {
    for (const part of [element, ...element.querySelectorAll('*')]) {
      const rect = part.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      if (part !== element && getComputedStyle(part).visibility === 'hidden') continue;
      left = Math.min(left, rect.left); top = Math.min(top, rect.top); right = Math.max(right, rect.right); bottom = Math.max(bottom, rect.bottom);
    }
  }
  if (!Number.isFinite(left)) return null;
  return { x: (left - origin.left) / scale, y: (top - origin.top) / scale, width: (right - left) / scale, height: (bottom - top) / scale };
}
function FittedStage({ game, children }) {
  const frameRef = useRef(null);
  const stageRef = useRef(null);
  const smallest = useRef(Infinity);
  // The board-zoom scale is tracked apart from the whole-game scale: a game
  // that shows a loading message first (Pepper Placer) gets its zoom once its
  // board appears, rather than being held to the loading screen's scale.
  const smallestFocus = useRef(Infinity);
  const measureRef = useRef(null);
  const [fit, setFit] = useState(null);
  const active = !!fit;
  // Measure again once the frame's styles are in place.
  useLayoutEffect(() => { if (active) measureRef.current?.(); }, [active]);
  useLayoutEffect(() => {
    const media = window.matchMedia?.(FIT_QUERY);
    if (!media) return undefined;
    let frame = 0, retry = 0, retries = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = frameRef.current, stage = stageRef.current;
        if (!box || !stage) return;
        if (!media.matches) { setFit(null); return; }
        const top = box.getBoundingClientRect().top + window.scrollY;
        const height = Math.max(320, Math.floor(window.innerHeight - top - 10));
        const width = box.clientWidth;
        // Only ever shrink during a game, so the board doesn't jump when a
        // message or extra row appears. The first pass happens before the
        // frame's own styles apply, so it doesn't count toward that.
        const fitted = box.classList.contains('fitted');
        // Zoom the board to fill the playing area, centred in it. The zoom
        // only ever shrinks during a game (a growing message can't make the
        // board jump), and the board stays centred whatever moves around it.
        // The scale the stage is drawn at right now (read back from the page,
        // since a new one may not have been applied yet).
        const transform = getComputedStyle(stage).transform;
        const drawn = transform && transform !== 'none' ? new DOMMatrixReadOnly(transform).a || 1 : 1;
        const focus = FOCUS[game] && focusBox(stage, FOCUS[game], drawn);
        // Board not drawn yet (a loading message in the same space): look again
        // shortly, since its arrival may not change the stage's size.
        if (FOCUS[game] && !focus && retries < 50) { retries += 1; clearTimeout(retry); retry = setTimeout(measure, 200); }
        if (focus) {
          const areaWidth = Math.min(980, window.innerWidth - 16) - AREA_PADDING * 2, areaHeight = height - AREA_PADDING * 2;
          const raw = Math.min(MAX_ZOOM, Math.floor(Math.min(areaWidth / focus.width, areaHeight / focus.height) * 100) / 100);
          const scale = fitted ? Math.min(smallestFocus.current, raw) : raw;
          if (fitted) smallestFocus.current = scale;
          const x = Math.round(width / 2 - scale * (focus.x + focus.width / 2));
          const y = Math.round(height / 2 - scale * (focus.y + focus.height / 2));
          // The frame grows to hold anything below the board (tools), so it
          // can still be reached by scrolling.
          const outer = Math.max(height, Math.ceil(y + scale * stage.offsetHeight));
          // Hide whatever sits above the board (titles, mode buttons), so the
          // playing area shows only the board.
          const clip = Math.max(0, Math.floor(y + scale * focus.y - AREA_PADDING / 2));
          setFit(previous => previous && previous.focus && previous.scale === scale && previous.height === height && previous.width === width && previous.outer === outer && previous.x === x && previous.y === y && previous.clip === clip
            ? previous : { focus: true, scale, height, width, outer, x, y, clip });
          return;
        }
        // Cartograskeet sizes its map to the frame itself (see Gauntlet.css),
        // with its tools below the frame, so it is never scaled.
        const raw = UNSCALED_GAMES.includes(game) ? 1 : Math.min(1, Math.floor(height / Math.max(1, stage.offsetHeight) * 100) / 100);
        const scale = fitted ? Math.min(smallest.current, raw) : raw;
        if (fitted) smallest.current = scale;
        // An unscaled game's tools run on below the frame; the frame grows to
        // hold them so the page below isn't covered.
        const outer = UNSCALED_GAMES.includes(game) ? Math.max(height, stage.offsetHeight) : height;
        setFit(previous => previous && previous.scale === scale && previous.height === height && previous.width === width && previous.outer === outer ? previous : { scale, height, width, outer });
      });
    };
    const resized = () => { smallest.current = Infinity; smallestFocus.current = Infinity; measure(); };
    measureRef.current = measure;
    const observer = new ResizeObserver(measure);
    observer.observe(stageRef.current);
    window.addEventListener('resize', resized);
    media.addEventListener?.('change', resized);
    measure();
    return () => { cancelAnimationFrame(frame); clearTimeout(retry); observer.disconnect(); window.removeEventListener('resize', resized); media.removeEventListener?.('change', resized); };
  }, []);
  return <div ref={frameRef} className={`gauntlet-frame${fit ? ' fitted' : ''}`} style={fit ? { height: fit.outer, clipPath: fit.clip ? `inset(${fit.clip}px 0 0 0)` : undefined } : undefined}>
    <div ref={stageRef} className="gauntlet-stage" data-game={game}
      style={!fit ? undefined : fit.focus
        ? { width: fit.width, left: 0, transformOrigin: '0 0', transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`, '--frame-h': `${fit.height}px` }
        : { width: fit.width, transform: `translateX(-50%) scale(${fit.scale})`, '--frame-h': `${fit.height}px` }}>{children}</div>
  </div>;
}

// Sign-in and nickname for the leaderboard.
function PlayerBar({ player, onSignIn, onNickname, onSignOut, busy, error }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  if (player === undefined) return null;
  if (!player) return <div className="gauntlet-player">
    <button type="button" className="gauntlet-btn gauntlet-google" onClick={onSignIn} disabled={busy}>Sign in</button>
    <span>to get on the leaderboard. You can also play without signing in.</span>
    {error && <p className="gauntlet-player-error" role="alert">{error}</p>}
  </div>;
  if (!player.nickname || editing) {
    const submit = async event => {
      event.preventDefault();
      if (await onNickname(name)) setEditing(false);
    };
    return <form className="gauntlet-player" onSubmit={submit}>
      <label htmlFor="gauntlet-nickname">{player.nickname ? 'New nickname' : 'Choose a leaderboard nickname'}</label>
      <input id="gauntlet-nickname" value={name} onChange={event => setName(event.target.value)} maxLength={16} minLength={3}
        placeholder="3–16 letters or numbers" autoComplete="nickname" autoFocus={!!player.nickname} />
      <button type="submit" className="gauntlet-btn" disabled={busy || name.trim().length < 3}>Save</button>
      {player.nickname && <button type="button" className="gauntlet-btn" onClick={() => setEditing(false)}>Cancel</button>}
      {error && <p className="gauntlet-player-error" role="alert">{error}</p>}
    </form>;
  }
  return <div className="gauntlet-player">
    <span>Playing as <strong>{player.nickname}</strong></span>
    <button type="button" className="gauntlet-link" onClick={() => { setName(player.nickname); setEditing(true); }}>Change name</button>
    <button type="button" className="gauntlet-link" onClick={onSignOut}>Sign out</button>
    {error && <p className="gauntlet-player-error" role="alert">{error}</p>}
  </div>;
}

function Leaderboard({ title, board, uid }) {
  if (!board) return null;
  if (board.error) return <section className="gauntlet-board"><h2>{title}</h2><p className="gauntlet-note">{board.error}</p></section>;
  const { entries, standing, mine } = board;
  const shownMine = entries.some(entry => entry.uid === uid);
  return <section className="gauntlet-board" aria-label={title}>
    <h2>{title}</h2>
    {standing && <p className="gauntlet-standing">You're <strong>#{standing.rank}</strong> of {standing.players} {standing.players === 1 ? 'player' : 'players'}</p>}
    {entries.length === 0 ? <p className="gauntlet-note">No one has finished yet. Be the first!</p>
      : <table className="gauntlet-table gauntlet-board-table">
        <thead><tr><th>#</th><th>Player</th><th>Solved</th><th>Time</th></tr></thead>
        <tbody>
          {entries.map((entry, index) => <tr key={entry.uid} className={entry.uid === uid ? 'mine' : ''}>
            <td>{index + 1}</td><td>{entry.nickname}</td><td>{entry.solved}/6</td><td>{formatClock(entry.total)}</td>
          </tr>)}
          {!shownMine && mine && standing && <tr className="mine gauntlet-board-gap">
            <td>{standing.rank}</td><td>{mine.nickname}</td><td>{mine.solved}/6</td><td>{formatClock(mine.total)}</td>
          </tr>}
        </tbody>
      </table>}
    {entries.length >= BOARD_SIZE && <p className="gauntlet-note">Showing the top {BOARD_SIZE}.</p>}
  </section>;
}

export default function Gauntlet() {
  const [params] = useSearchParams();
  // Gauntlet days start at 4am Mountain Time. The day is fixed when the page
  // opens, so a run that crosses the reset finishes normally.
  // ?test=1 … ?test=9 opens a replayable test gauntlet instead of today's.
  const testNumber = Number(params.get('test'));
  const test = Number.isInteger(testNumber) && testNumber >= 1 && testNumber <= TEST_GAUNTLETS ? testNumber : 0;
  // ?day=YYYY-MM-DD opens a future gauntlet early, for the site owner only
  // (from /admin/gauntlets). It's timed in the browser; the finished run is
  // published as that day's time to beat and posted to that day's leaderboard
  // as if played when the day opened.
  const dayParam = params.get('day');
  const [advance] = useState(() => !test && /^\d{4}-\d{2}-\d{2}$/.test(dayParam ?? '') && dayParam > gauntletDay() ? dayParam : null);
  const [date] = useState(() => test ? testDay(test) : advance ?? gauntletDay());
  const [lineup] = useState(() => gauntletLineup(date));
  const [run, setRun] = useState(() => restoreRun(readLocal(runKey(date), null), date));
  const [history, setHistory] = useState(() => readLocal(HISTORY_KEY, {}) || {});
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const [rules, setRules] = useState(false);
  // Before starting: show where the gauntlet bar and games will sit, to line up a recording.
  const [framing, setFraming] = useState(false);
  const [copied, setCopied] = useState('');
  const runRef = useRef(run);
  // The owner's published time for today (undefined while loading).
  const [par, setPar] = useState(undefined);
  const [owner, setOwner] = useState(false);
  const [publishStatus, setPublishStatus] = useState('');
  useEffect(() => {
    let active = true;
    if (test) { setPar(null); return () => { active = false; }; }
    readPar(date).then(value => { if (active) setPar(validPar(value, date)); }).catch(() => { if (active) setPar(null); });
    return () => { active = false; };
  }, [date]);
  useEffect(() => watchOwner(setOwner), []);
  const open = !!test || (advance ? owner : gauntletLaunched(date) || params.get('preview') === '1');
  // The leaderboard is off for advance runs (the server only times today's).
  const boardOn = boardEnabled && !advance;

  // ----- Leaderboard -----
  // player: undefined while loading, null when signed out, else { uid, nickname }.
  const [player, setPlayer] = useState(boardEnabled ? undefined : null);
  const [playerBusy, setPlayerBusy] = useState(false);
  const [playerError, setPlayerError] = useState('');
  const [board, setBoard] = useState(null);
  const [syncNote, setSyncNote] = useState('');
  const [starting, setStarting] = useState(false);
  const skew = useRef(0);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  useEffect(() => watchPlayer(setPlayer), []);
  const ranked = boardOn && !!player?.nickname;
  const current = run && !run.finishedAt ? lineup[run.index] : null;
  const penalty = usePenalty(current?.id, current?.level);
  const penaltyRef = useRef(penalty);
  penaltyRef.current = penalty;

  const save = useCallback(next => {
    if (next === runRef.current) return;
    runRef.current = next;
    setRun(next);
    writeLocal(runKey(next.date), next);
    if (next.finishedAt && !test && !advance) setHistory(previous => {
      const updated = addToHistory(previous, next);
      writeLocal(HISTORY_KEY, updated);
      return updated;
    });
  }, []);

  const loadBoard = useCallback(async finished => {
    if (!boardOn || !open) return;
    try {
      const entries = await readBoard(date);
      let mine = null, standing = null;
      if (finished?.ranked && player?.uid) {
        mine = entries.find(entry => entry.uid === player.uid) ?? await readMyEntry(date, player.uid);
        if (mine) standing = await boardStanding(date, mine.score);
      }
      setBoard({ entries, standing, mine });
    } catch { setBoard({ error: 'The leaderboard could not be loaded right now.' }); }
  }, [date, open, player?.uid]);

  // The server's copy of a leaderboard run becomes this page's run.
  const adopt = useCallback(result => {
    if (!result) return;
    skew.current = Number.isFinite(result.now) ? result.now - Date.now() : skew.current;
    const serverRun = fromServerRun(result.run, skew.current);
    if (serverRun) save(serverRun);
    // A finished run is on the board now: show where it landed.
    if (result.entry) loadBoard(serverRun);
  }, [save, loadBoard]);

  // Events go to the server one at a time, in order. The page updates at once
  // and then takes the server's timing when the last pending event returns.
  const send = useCallback(event => {
    pending.current += 1;
    queue.current = queue.current.then(() => sendEvent(event)).then(result => {
      pending.current -= 1;
      if (pending.current === 0) adopt(result);
      setSyncNote('');
    }, error => {
      pending.current -= 1;
      setSyncNote(`Couldn't reach the leaderboard (${friendlyError(error)}). Refresh the page to resync your run.`);
    });
    return queue.current;
  }, [adopt]);

  // On load, pick up a leaderboard run started on this or another device.
  useEffect(() => {
    if (!boardOn || !open || !player?.uid) return;
    let active = true;
    readMyRun(date, player.uid).then(serverRun => {
      if (!active || !serverRun || pending.current) return;
      const local = runRef.current;
      if (local && !local.ranked && local.results.length > (serverRun.results?.length ?? 0)) return;
      adopt({ run: serverRun });
    }).catch(() => {});
    return () => { active = false; };
  }, [date, open, player?.uid, adopt]);

  // Games report their own finish (see GauntletReport in DailyResults).
  // Extras: guesses (word games' guess bonus) and hints (Skeedle Beadle).
  const onResult = useCallback((gameId, status, extras = {}) => {
    const active = runRef.current;
    if (!active || active.waiting || active.finishedAt || active.lineup[active.index] !== gameId) return;
    const penaltySeconds = penaltyRef.current?.seconds ?? 0;
    const guessCount = Number.isInteger(extras.guesses) ? extras.guesses : undefined;
    const live = hintsRef.current;
    const hintCount = Number.isInteger(extras.hints) ? extras.hints : live.game === gameId ? live.count : undefined;
    save(recordResult(active, { gameId, status, now: Date.now(), penalty: penaltySeconds, guesses: guessCount, hints: hintCount }));
    setConfirming(false);
    if (active.ranked) send({ action: 'finish', day: active.date, game: gameId, status, penalty: penaltySeconds, guesses: guessCount, hints: hintCount });
  }, [save, send]);
  // Hints used so far in the current game, so the clock shows their cost live.
  const [liveHints, setLiveHints] = useState({ game: null, count: 0 });
  const hintsRef = useRef(liveHints);
  hintsRef.current = liveHints;
  const onHints = useCallback((gameId, count) => setLiveHints(current =>
    current.game === gameId && current.count === count ? current : { game: gameId, count }), []);

  useEffect(() => {
    if (!run || run.finishedAt || run.waiting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [run]);
  useEffect(() => { window.scrollTo?.(0, 0); }, [run?.index, run?.waiting]);
  const showBoard = !run || !!run.finishedAt;
  const boardRunKey = run?.finishedAt ? `${run.finishedAt}:${run.ranked}` : '';
  useEffect(() => {
    if (showBoard) loadBoard(runRef.current?.finishedAt ? runRef.current : null);
  }, [showBoard, boardRunKey, loadBoard]);

  const start = async ({ unranked = false } = {}) => {
    setSyncNote('');
    if (ranked && !unranked) {
      setStarting(true);
      try {
        const result = await sendEvent({ action: 'start', day: date });
        setNow(Date.now());
        const serverRun = fromServerRun(result.run, Number.isFinite(result.now) ? result.now - Date.now() : 0);
        if (!serverRun) {
          setSyncNote('Your saved run doesn\'t match today\'s games. The leaderboard server needs updating: please try again shortly.');
          return;
        }
        if (result.alreadyStarted) setSyncNote('You already started today\'s gauntlet, so you\'re picking up where you left off.');
        adopt(result);
      } catch (error) {
        setSyncNote(`Couldn't start a leaderboard run: ${friendlyError(error)}`);
      } finally { setStarting(false); }
      return;
    }
    setNow(Date.now());
    save(newRun(date, Date.now()));
  };
  const next = () => {
    const active = runRef.current;
    setNow(Date.now());
    save(startNextGame(active, Date.now()));
    if (active?.ranked) send({ action: 'next', day: active.date });
  };

  const [signingIn, setSigningIn] = useState(false);
  const signIn = () => { setPlayerError(''); setSigningIn(true); };
  async function chooseNickname(name) {
    setPlayerBusy(true); setPlayerError('');
    try {
      const { nickname } = await saveNickname(name);
      setPlayer(previous => previous && { ...previous, nickname });
      if (board?.mine) setBoard(previous => ({ ...previous, mine: { ...previous.mine, nickname } }));
      loadBoard(runRef.current?.finishedAt ? runRef.current : null);
      return true;
    } catch (error) { setPlayerError(friendlyError(error)); return false; } finally { setPlayerBusy(false); }
  }
  // How to play pauses the clock and hides the board until it's closed.
  const openRules = () => {
    const active = runRef.current;
    setRules(true);
    if (!active || active.waiting || active.finishedAt || active.pausedAt) return;
    save(pauseRun(active, Date.now()));
    if (active.ranked) send({ action: 'pause', day: active.date });
  };
  const closeRules = () => {
    const active = runRef.current;
    setRules(false);
    setNow(Date.now());
    if (!active?.pausedAt) return;
    save(resumeRun(active, Date.now()));
    if (active.ranked) send({ action: 'resume', day: active.date });
  };
  // A run left paused (page closed with How to play open) resumes on return.
  const resumedOnLoad = useRef(false);
  useEffect(() => {
    if (resumedOnLoad.current || !run) return;
    resumedOnLoad.current = true;
    if (run.pausedAt && !rules) closeRules();
  });
  const giveUp = () => { const active = runRef.current; if (active) onResult(active.lineup[active.index], 'gave-up'); };
  const playing = run && !run.finishedAt && !run.waiting ? run.lineup[run.index] : null;
  const liveHintSeconds = playing && liveHints.game === playing ? hintPenalty(playing, liveHints.count) : 0;
  const total = runTotal(run) + currentGameSeconds(run, now) + liveHintSeconds;
  // What giving up would add right now: the rounded average solve time, minus
  // the time already spent on this game (gone once you pass the average).
  const penaltyLeft = remainingPenalty(penalty?.seconds ?? 0, currentGameSeconds(run, now));

  // The owner's finished run becomes today's time to beat.
  const publish = useCallback(async finished => {
    setPublishStatus('Publishing your time…');
    try { const record = await publishPar(finished); setPar(record); setPublishStatus(`Published. Everyone now sees your time as ${PAR_NAME}'s time to beat.`); }
    catch (error) { setPublishStatus(`Could not publish your time${error?.code ? ` (${error.code})` : ''}. Try again.`); }
  }, []);
  const autoPublished = useRef(false);
  useEffect(() => {
    if (test || !owner || !run?.finishedAt || autoPublished.current || par === undefined) return;
    autoPublished.current = true;
    // An advance run (re)publishes its time; on the day itself an existing
    // time to beat (e.g. recorded in advance) is kept unless you press Publish.
    if (!par || (advance && par.total !== runTotal(run))) publish(run);
  }, [owner, run, par, publish]);
  // The owner's finished run that isn't on the leaderboard yet (an advance
  // run, or one played off the board) is posted to that day's leaderboard.
  const [recordStatus, setRecordStatus] = useState('');
  const record = useCallback(async finished => {
    setRecordStatus('Posting your run to the leaderboard…');
    try {
      const result = await sendEvent({ action: 'record', day: finished.date,
        run: { results: finished.results, startedAt: finished.startedAt, finishedAt: finished.finishedAt } });
      save({ ...finished, ranked: true });
      setRecordStatus(result?.alreadyRecorded ? 'You already have a run on this day\'s leaderboard, so it was kept.'
        : `Posted to ${advance ? `${advanceLabel}'s` : 'today\'s'} leaderboard, as if played when it opened.`);
    } catch (error) { setRecordStatus(`Couldn't post your run to the leaderboard (${friendlyError(error)}).`); }
  }, [save]);
  const canRecord = owner && !test && !!run?.finishedAt && !run.ranked && boardEnabled && !!player?.nickname;
  const autoRecorded = useRef(false);
  useEffect(() => {
    if (!canRecord || autoRecorded.current) return;
    autoRecorded.current = true;
    record(run);
  }, [canRecord, run, record]);
  // No finished run in this browser (played on another device, or storage
  // cleared) but this day's time to beat is published: post that instead.
  // It holds each game's result and time, which is all the board needs.
  const [checkedServer, setCheckedServer] = useState(false);
  useEffect(() => {
    if (!player?.uid || !open || test) return;
    let active = true;
    readMyRun(date, player.uid).then(() => {}, () => {}).finally(() => { if (active) setCheckedServer(true); });
    return () => { active = false; };
  }, [date, open, test, player?.uid]);
  const canRecordPar = owner && !test && open && !run && checkedServer && !!par && boardEnabled && !!player?.nickname;
  useEffect(() => {
    if (!canRecordPar || autoRecorded.current) return;
    autoRecorded.current = true;
    setRecordStatus('Posting your published time to the leaderboard…');
    sendEvent({ action: 'record', day: date, run: { results: par.results.map(({ game, status, total }) =>
      ({ game, status, seconds: total, penalty: 0, bonus: 0, hintPenalty: 0 })) } })
      .then(result => {
        adopt(result);
        setRecordStatus(result?.alreadyRecorded ? 'Your run was already on the leaderboard.' : 'Posted your published time to the leaderboard, as if played when the gauntlet opened.');
      }, error => setRecordStatus(`Couldn't post your published time to the leaderboard (${friendlyError(error)}). Refresh to try again.`));
  }, [canRecordPar, date, par, adopt]);
  const showPar = par && !owner;
  const isOwner = owner && !test;
  const summary = historySummary(history, date);
  const boardTitle = test ? `Test ${test} leaderboard` : 'Today\'s leaderboard';

  // Enter starts the next game from the break screen. Ignored on a focused
  // button (it clicks itself), for held-down keys, and just after a game ends
  // so the Enter that finished a word game can't skip the break.
  const startBlocked = starting || (boardOn && !!player && !player.nickname);
  const enterAction = open && run?.waiting ? next : null;
  const enterRef = useRef(enterAction);
  enterRef.current = enterAction;
  const screenShownAt = useRef(0);
  useEffect(() => { screenShownAt.current = Date.now(); }, [run?.index, run?.waiting, !!run]);
  useEffect(() => {
    const onKey = event => {
      if (event.key !== 'Enter' || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target?.closest?.('input, textarea, select, button, a, [contenteditable="true"]')) return;
      if (!enterRef.current || Date.now() - screenShownAt.current < 500) return;
      event.preventDefault();
      enterRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function share() {
    const text = shareText(run, window.location.origin, showPar ? par : null);
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied('Copied to clipboard'); }
    } catch { setCopied('Copy failed — select the text below'); }
  }

  const pips = <ol className="gauntlet-pips" aria-label="Progress">
    {lineup.map((game, index) => {
      const result = run?.results[index];
      const state = result ? (result.status === 'won' ? 'won' : 'lost') : run && !run.finishedAt && index === run.index ? 'current' : '';
      return <li key={game.id} className={state} title={`${game.title}${result ? ` · ${statusLabel[result.status]}` : ''}`}>{index + 1}</li>;
    })}
  </ol>;

  const advanceLabel = advance && new Date(`${advance}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  let body;
  if (advance && !open) {
    body = <section className="gauntlet-card gauntlet-intro">
      <p className="gauntlet-eyebrow">Not open yet</p>
      <h1>Skeeter Gauntlet</h1>
      <p>This gauntlet opens {new Date(gauntletOpensAt(advance)).toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.</p>
      <Link className="gauntlet-btn" to="/gauntlet">Play today's gauntlet</Link>
    </section>;
  } else if (!open) {
    body = <section className="gauntlet-card gauntlet-intro">
      <p className="gauntlet-eyebrow">Coming soon</p>
      <h1>Skeeter Gauntlet</h1>
      <p>{GAUNTLET_START ? `The first gauntlet opens ${new Date(gauntletOpensAt(GAUNTLET_START)).toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.` : 'Six puzzles. One clock. One attempt a day. The Skeeter Gauntlet is coming soon.'}</p>
      <Link className="gauntlet-btn" to="/">Back to the puzzles</Link>
    </section>;
  } else if (!run && framing) {
    // The same bar and frame the games use, empty, with the playing area outlined.
    body = <>
      <div className="gauntlet-hud gauntlet-hud-preview">
        <div className="gauntlet-hud-game"><span>Game 1 of {lineup.length}</span><strong>{lineup[0].title}</strong><ChiliRating level={lineup[0].level} /></div>
        {pips}
        <div className="gauntlet-hud-clock">0:00</div>
        <div className="gauntlet-hud-actions">
          <button type="button" className="gauntlet-btn" onClick={() => setFraming(false)}>Back</button>
          <span className="gauntlet-giveup">
            <button type="button" className="gauntlet-btn gauntlet-framing-start" onClick={() => { setFraming(false); start(); }} disabled={startBlocked}>Start</button>
            <small>Clock starts</small>
          </span>
        </div>
      </div>
      <FittedStage key="framing" game="framing">
        <div className="gauntlet-framing-box">
          <strong>Playing area</strong>
          <span>Every game appears inside this box, under the bar above. Line your capture up with the bar and this box, then press Start.</span>
          <span className="gauntlet-framing-note">Cartograskeet's palette sits just below the box.</span>
        </div>
      </FittedStage>
    </>;
  } else if (!run) {
    body = <section className="gauntlet-card gauntlet-intro">
      <p className="gauntlet-eyebrow">Daily challenge</p>
      <h1>Skeeter Gauntlet</h1>
      <p className="gauntlet-lede">Six puzzles. One clock. One attempt a day.</p>
      {showPar && <p className="gauntlet-par">{PAR_NAME}'s time today: <strong>{formatClock(par.total)}</strong> · Can you beat it?</p>}
      {isOwner && <p className="gauntlet-par">Signed in as the owner: your finished time will be published as {PAR_NAME}'s time to beat{advance ? ' and posted to that day\'s leaderboard' : ''}.</p>}
      {isOwner && recordStatus && <p className="gauntlet-par">{recordStatus}</p>}
      {boardOn && <PlayerBar player={player} busy={playerBusy} error={playerError} onSignIn={signIn} onNickname={chooseNickname}
        onSignOut={() => { setPlayerError(''); signOutPlayer().catch(() => {}); }} />}
      <ol className="gauntlet-lineup">
        {lineup.map((game, index) => <li key={game.id}><span className="gauntlet-lineup-number">{index + 1}</span><span>{game.title}</span><ChiliRating level={game.level} /></li>)}
      </ol>
      <ul className="gauntlet-rules">
        <li>Solve all six back to back. Each game's time counts toward your total.</li>
        <li>These are gauntlet-only puzzles, separate from today's dailies.</li>
        <li>Stuck? Give up to move on. Giving up (or losing) adds a penalty: that game's average solve time at its spice level, rounded to the minute. The penalty counts down while you play and disappears once you've spent that long, so it always pays to keep going.</li>
        <li>The clock keeps running if you leave mid-game, and pauses between games until you start the next one.</li>
        <li>Opening How to play during a game pauses the clock and hides the board, for up to 5 minutes per gauntlet.</li>
        <li>Skeedle Beadle: each hint adds 5 seconds to your time.</li>
        <li>Word games (Skeedle+, Ske4dle, Parshle and Skeedle500): every guess you don't need takes 5 seconds off your time. The time off for solving on each guess is shown beside the row.</li>
        <li>You get one attempt per day. <GauntletCountdown /></li>
        {boardOn && <li>Signed-in players are timed by the server and ranked on the daily leaderboard: most games solved first, then the fastest total time.</li>}
      </ul>
      <button type="button" className="gauntlet-btn gauntlet-btn-primary" onClick={() => start()} disabled={startBlocked}>
        {starting ? 'Starting…' : 'Start the gauntlet'}</button>
      {owner && <button type="button" className="gauntlet-btn gauntlet-framing-open" onClick={() => { setFraming(true); window.scrollTo(0, 0); }}>Show playing area for filming</button>}
      {owner && !advance && <Link className="gauntlet-btn gauntlet-framing-open" to="/admin/gauntlets">Record upcoming gauntlets</Link>}
      {boardOn && player && !player.nickname && <p className="gauntlet-note">Choose a nickname above to start.</p>}
      {boardOn && !player && player !== undefined && <p className="gauntlet-note">Playing without signing in? Your time won't be on the leaderboard.</p>}
      {syncNote && ranked && !starting && <><p className="gauntlet-note gauntlet-sync" role="alert">{syncNote}</p>
        <button type="button" className="gauntlet-btn" onClick={() => start({ unranked: true })}>Play without the leaderboard</button></>}
      {boardOn && <Leaderboard title={boardTitle} board={board} uid={player?.uid} />}
    </section>;
  } else if (run.finishedAt) {
    const solved = run.results.filter(result => result.status === 'won').length;
    body = <section className="gauntlet-card gauntlet-done">
      <p className="gauntlet-eyebrow">{solved === lineup.length ? 'Gauntlet conquered' : 'Gauntlet complete'}</p>
      <h1>{formatClock(runTotal(run))}</h1>
      {showPar && <p className={`gauntlet-par-verdict${runTotal(run) < par.total ? ' won' : ''}`}>{parVerdict(runTotal(run), par.total)} <span>({PAR_NAME}: {formatClock(par.total)})</span></p>}
      {isOwner && <p className="gauntlet-par">{publishStatus || (par && par.total === runTotal(run) ? `This is ${advance ? `${advanceLabel}'s` : 'today\'s'} ${PAR_NAME} time.` : '')}
        {(!par || par.total !== runTotal(run)) && !/Publishing/.test(publishStatus) && <> <button type="button" className="gauntlet-btn" onClick={() => publish(run)}>Publish my time</button></>}</p>}
      {pips}
      <table className="gauntlet-table">
        <thead><tr><th>Game</th><th>Result</th><th>Time</th></tr></thead>
        <tbody>{run.results.map((result, index) => <tr key={result.game} className={result.status === 'won' ? 'won' : 'lost'}>
          <td><span className="gauntlet-lineup-number">{index + 1}</span>{gameTitle(result.game)}</td>
          <td>{statusLabel[result.status]}</td>
          <td>{formatClock(result.total)}{result.penalty > 0 && <small> ({formatClock(result.seconds)} + {formatClock(result.penalty)} penalty)</small>}
            {result.bonus > 0 && <small> ({formatClock(result.seconds)} − {result.bonus}s guess bonus)</small>}
            {result.hintPenalty > 0 && <small> (includes +{result.hintPenalty}s for hints)</small>}</td>
        </tr>)}</tbody>
      </table>
      {isOwner && (recordStatus || (advance && run.ranked)) && <p className="gauntlet-par">{recordStatus || `This run is on ${advanceLabel}'s leaderboard.`}
        {/^Couldn't/.test(recordStatus) && <> <button type="button" className="gauntlet-btn" onClick={() => record(run)}>Try again</button></>}</p>}
      {isOwner && advance && !run.ranked && !recordStatus && player !== undefined && !player?.nickname && <p className="gauntlet-note">Sign in with a nickname to post this run to the leaderboard.</p>}
      {boardOn && !run.ranked && !recordStatus && <p className="gauntlet-note">This run isn't on the leaderboard{player ? '' : ' because you weren\'t signed in'}.</p>}
      {boardOn && <Leaderboard title={boardTitle} board={board} uid={player?.uid} />}
      <div className="gauntlet-stats">
        <div><strong>{summary.played}</strong><span>Played</span></div>
        <div><strong>{summary.bestTime === null ? '—' : formatClock(summary.bestTime)}</strong><span>Best time</span></div>
        <div><strong>{summary.streak}</strong><span>Streak</span></div>
        <div><strong>{summary.maxStreak}</strong><span>Best streak</span></div>
      </div>
      <button type="button" className="gauntlet-btn gauntlet-btn-primary" onClick={share}>Share result</button>
      {copied && <p className="gauntlet-note" role="status">{copied}</p>}
      <pre className="gauntlet-share-text">{shareText(run, window.location.origin, showPar ? par : null)}</pre>
      <p className="gauntlet-note"><GauntletCountdown /></p>
      <Link className="gauntlet-btn" to="/">Back to the puzzles</Link>
    </section>;
  } else if (run.waiting) {
    const last = run.results.at(-1), upcoming = lineup[run.index];
    body = <section className="gauntlet-card gauntlet-break">
      {pips}
      <p className={`gauntlet-result ${last.status === 'won' ? 'won' : 'lost'}`}>
        {last.status === 'won' ? `${gameTitle(last.game)} solved in ${formatClock(last.seconds)}${last.hintPenalty > 0 ? ` + ${last.hintPenalty}s for hints` : ''}${last.bonus > 0 ? ` − ${last.bonus}s guess bonus` : ''}${last.bonus > 0 || last.hintPenalty > 0 ? ` = ${formatClock(last.total)}` : ''}`
          : `${gameTitle(last.game)}: ${statusLabel[last.status].toLowerCase()} — ${formatClock(last.seconds)}${last.penalty > 0 ? ` + ${formatClock(last.penalty)} penalty` : ', no penalty'}${last.hintPenalty > 0 ? ` + ${last.hintPenalty}s for hints` : ''}`}
      </p>
      <p className="gauntlet-total">Total so far <strong>{formatClock(runTotal(run))}</strong></p>
      {showPar && <p className="gauntlet-pace">{ahead(paceVersusPar(run, par))} after {run.results.length} {run.results.length === 1 ? 'game' : 'games'}</p>}
      <p className="gauntlet-up-next">Up next: <strong>{upcoming.title}</strong> <ChiliRating level={upcoming.level} /></p>
      <button type="button" className="gauntlet-btn gauntlet-btn-primary" onClick={next}>Start game {run.index + 1} of {lineup.length}</button>
      <p className="gauntlet-note">The clock is paused until you start. Press Enter when you're ready.</p>
    </section>;
  } else {
    const Game = COMPONENTS[current.id];
    body = <>
      <div className="gauntlet-hud">
        <div className="gauntlet-hud-game"><span>Game {run.index + 1} of {lineup.length}</span><strong>{current.title}</strong><ChiliRating level={current.level} /></div>
        {pips}
        <div className={`gauntlet-hud-clock${run.pausedAt ? ' paused' : ''}`} aria-label={run.pausedAt ? 'Gauntlet time, paused' : 'Gauntlet time'}>{formatClock(total)}{showPar && <small>{PAR_NAME} {formatClock(par.total)}</small>}</div>
        <div className="gauntlet-hud-actions">
          {COLORBLIND_GAMES.includes(current.id) && <ColorblindToggle />}
          <button type="button" className="gauntlet-btn" onClick={openRules}>How to play</button>
          {confirming
            ? <span className="gauntlet-confirm">{penaltyLeft > 0 ? `Give up and add ${formatClock(penaltyLeft)}?` : 'Give up? No penalty now.'}
                <button type="button" className="gauntlet-btn gauntlet-btn-danger" onClick={giveUp}>Give up</button>
                <button type="button" className="gauntlet-btn" onClick={() => setConfirming(false)}>Keep playing</button></span>
            : <span className="gauntlet-giveup">
                <button type="button" className="gauntlet-btn" onClick={() => setConfirming(true)}>Give up</button>
                {penaltyLeft > 0 && <small aria-label={`Give-up penalty ${formatClock(penaltyLeft)}, shrinking as you play`}>Penalty {formatClock(penaltyLeft)}</small>}
              </span>}
        </div>
      </div>
      <GauntletBoundary date={gauntletPuzzleDate(date)} onResult={onResult} onHints={onHints}>
        <div className={`gauntlet-pausable${run.pausedAt ? ' paused' : ''}`}>
          <FittedStage key={`${current.id}:${run.index}`} game={current.id}><Game /></FittedStage>
          {run.pausedAt && <p className="gauntlet-paused-note">Paused · close How to play to continue</p>}
        </div>
      </GauntletBoundary>
      {rules && <GameModal titleId="gauntlet-rules" onClose={closeRules}>
        <p className="daily-results-eyebrow">{current.title}</p>
        <h2 id="gauntlet-rules">How to play</h2>
        <ol className="game-instructions-list">{(gameInstructions[current.id] ?? []).map(rule => <li key={rule}>{rule}</li>)}</ol>
      </GameModal>}
    </>;
  }

  // Test gauntlets can be restarted: clear the run and every game's saved
  // progress for its puzzle date, so the same six puzzles start fresh.
  async function restartTest() {
    const puzzleDate = gauntletPuzzleDate(date);
    if (runRef.current?.ranked) {
      await queue.current;
      try { await sendEvent({ action: 'reset', day: date }); } catch (error) { setSyncNote(`Couldn't reset the leaderboard run: ${friendlyError(error)}`); return; }
    }
    setSyncNote(''); setBoard(null);
    forgetLocal(key => key.includes(puzzleDate) || key === runKey(date));
    runRef.current = null; setRun(null); setConfirming(false); setCopied('');
  }

  return <main className={`gauntlet-page${run && !run.finishedAt && !run.waiting ? ' playing' : ''}`}>
    <Navbar />
    {test > 0 && <div className="gauntlet-test-bar" role="note">
      <strong>Test gauntlet {test}</strong>
      <span>Replayable · not saved to your stats · your time is never published</span>
      <nav aria-label="Test gauntlets">{[1, 2, 3].map(n => <a key={n} href={`/gauntlet?test=${n}`} aria-current={n === test ? 'page' : undefined}>Test {n}</a>)}</nav>
      {run && <button type="button" className="gauntlet-btn" onClick={restartTest}>Restart this test</button>}
    </div>}
    {/* Hidden mid-game and in the filming preview so the bar and games sit
        exactly where they will on the day. */}
    {advance && open && !framing && !(run && !run.finishedAt && !run.waiting) && <div className="gauntlet-test-bar gauntlet-advance-bar" role="note">
      <strong>Advance gauntlet · {advanceLabel}</strong>
      <span>Only you can open this before it goes live. When you finish, your time is published as that day's {PAR_NAME} time to beat and posted to that day's leaderboard, as if you'd played it when it opened.</span>
      <Link to="/admin/gauntlets">All upcoming gauntlets</Link>
      {run && <button type="button" className="gauntlet-btn" onClick={restartTest}>Restart this gauntlet</button>}
    </div>}
    {syncNote && run && !run.finishedAt && <p className="gauntlet-sync-bar" role="alert">{syncNote}</p>}
    {signingIn && <SignInDialog onClose={() => setSigningIn(false)} />}
    {body}
  </main>;
}
