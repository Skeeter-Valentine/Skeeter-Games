import { useEffect, useRef, useState } from 'react';
import GameModal from './GameModal';
import GameToolbar from './GameToolbar';
import PuzzleRate from './PuzzleRate';
import { clockKey, formatDuration, readDailyStats, readLocal, recordDailyResult, summarizeDailyStats, validSeconds, writeLocal } from '../utils/dailyStats.js';
import './DailyResults.css';
import { useDailyDate, useDailyMode, useArchive } from './DailyBoundary';
import { archiveStatsId } from '../utils/archive.js';
import { sendPuzzleResult, puzzleLoggingEnabled } from '../services/puzzleResults.js';

// Icons remain available in every mode. Only daily sessions record results
// or run the shared clock; existing game timers remain authoritative.
export default function DailyResults({ daily, date, ...props }) {
  const sessionDate = useDailyDate();
  useDailyMode(daily);
  const resultDate = date ?? sessionDate;
  return <DailySession key={`${props.gameId}:${resultDate}:${daily}`} daily={daily} date={resultDate} {...props} />;
}

function DailySession({ gameId, title, date, daily, finished, won = true, seconds, ready = true,
  manualOpen = false, onClose, legacyStats, started = false, autoOpen = true }) {
  const archive = !!useArchive()?.archive;
  const statsId = archiveStatsId(gameId, archive);
  const [stats, setStats] = useState(() => readDailyStats(statsId));
  const [syncStatus, setSyncStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [clock, setClock] = useState(() => {
    const saved = readLocal(clockKey(statsId, date), 0);
    return validSeconds(saved) ? saved : 0;
  });
  const elapsed = useRef(clock);
  const handled = useRef(false);
  const hasTimer = seconds !== undefined;
  const attemptStarted = started || (hasTimer && seconds > 0) || finished;
  useEffect(() => {
    if (!daily || !ready || !attemptStarted) return;
    let active = true, retry;
    const sync = () => {
      clearTimeout(retry);
      sendPuzzleResult(gameId, date, archive ? 'archive' : 'daily', finished ? won ? 'won' : 'lost' : 'started', seconds ?? elapsed.current)
        .then(sent => { if (active) setSyncStatus(sent ? 'Community result synced.' : 'Saved locally. Community reporting is not enabled yet.'); })
        .catch(() => { if (active) { setSyncStatus('Saved locally. Community sync pending.'); retry = setTimeout(sync, 30000); } });
    };
    sync(); window.addEventListener('online', sync);
    return () => { active = false; clearTimeout(retry); window.removeEventListener('online', sync); };
    // Only transitions matter; ticking timers must not write every second.
  }, [gameId, date, archive, daily, ready, attemptStarted, finished, won]);

  useEffect(() => {
    if (!daily || !started || hasTimer || finished || !ready || stats.results[date]) return;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      if (document.visibilityState !== 'hidden') elapsed.current += (now - last) / 1000;
      last = now;
      writeLocal(clockKey(statsId, date), elapsed.current);
      setClock(elapsed.current);
    };
    const visibility = () => { last = performance.now(); };
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      // Persist the fraction since the last tick, including a fast final move.
      if (document.visibilityState !== 'hidden') elapsed.current += (performance.now() - last) / 1000;
      writeLocal(clockKey(statsId, date), elapsed.current);
    };
  }, [gameId, date, daily, started, finished, ready, hasTimer, stats]);

  useEffect(() => {
    if (!daily || !finished || !ready) { handled.current = false; return; }
    if (handled.current) return;
    // Let the game's completion render settle; cleanup cancels stale mode
    // transitions and StrictMode's first effect run.
    const timer = setTimeout(() => {
      handled.current = true;
      const time = hasTimer ? seconds : elapsed.current >= 1 ? elapsed.current : null;
      setStats(recordDailyResult(statsId, date, won, time));
      if (autoOpen) setOpen(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [gameId, date, daily, finished, ready, won, seconds, hasTimer, autoOpen]);

  const visible = open || (daily && manualOpen);
  const close = () => { setOpen(false); onClose?.(); };
  const summary = summarizeDailyStats(stats, date);
  const result = stats.results[date];
  return <>
    <GameToolbar gameId={gameId} title={title} onStats={() => { setStats(readDailyStats(statsId)); setOpen(true); }}>
      {daily && !hasTimer && <span aria-label="Daily elapsed time">Time: {formatDuration(result?.seconds ?? clock)}</span>}
    </GameToolbar>
    {visible && <GameModal titleId={`daily-title-${gameId}`} onClose={close}>
        <p className="daily-results-eyebrow">{title} · {archive ? 'Archive · ' : ''}{date}</p>
        <h2 id={`daily-title-${gameId}`}>{result ? result.won ? 'Puzzle complete!' : 'Game finished' : archive ? 'Your archive statistics' : 'Your daily statistics'}</h2>
        {result && <div className="daily-results-time"><span>{result.won ? 'Completion time' : 'Time played'}</span><strong>{formatDuration(result.seconds)}</strong></div>}
        <div className="daily-results-grid">
          {[[summary.played, 'Finished'], [summary.wins, 'Wins'], [`${summary.winRate}%`, 'Win rate'],
            ...(!archive ? [[summary.currentStreak, 'Current streak'], [summary.maxStreak, 'Best streak']] : []),
            [summary.bestTime === null ? '—' : formatDuration(summary.bestTime), 'Best solve'],
            [summary.averageTime === null ? '—' : formatDuration(summary.averageTime), 'Average solve']].map(([value, label]) =>
            <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
        </div>
        <PuzzleRate gameId={gameId} date={date} mode={archive ? 'archive' : 'daily'} refresh={syncStatus} />
        {legacyStats?.played > 0 && <details className="daily-results-legacy"><summary>Legacy local statistics</summary>
          <p>{legacyStats.played} games in the original statistics. These totals may include replays or practice and are kept separate from dated daily results.</p>
          {legacyStats.wins != null && <p>Wins: {legacyStats.wins}</p>}
          {(legacyStats.maxStreak ?? legacyStats.streak) != null && <p>Recorded streak: {legacyStats.maxStreak ?? legacyStats.streak}</p>}
          {legacyStats.bestTime != null && <p>Best time: {formatDuration(legacyStats.bestTime)}</p>}
          {legacyStats.guessDistribution && <p>Guess distribution: {Object.entries(legacyStats.guessDistribution).map(([guesses, count]) => `${guesses} guesses: ${count}`).join(' · ')}</p>}
        </details>}
        <p className="daily-results-note">{archive ? 'Archive results are saved separately and never affect your live daily streak.' : 'Saved in this browser. Only your first result each day counts. Streaks require consecutive daily wins; solve times include wins only.'}</p>
        <p className="daily-results-note">{syncStatus || (puzzleLoggingEnabled ? 'Community results count the first attempt per player and puzzle date.' : 'Community reporting is not enabled yet.')}</p>
    </GameModal>}
  </>;
}
