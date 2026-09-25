import { useEffect, useRef, useState } from 'react';
import GameModal from './GameModal';
import GameToolbar from './GameToolbar';
import { clockKey, formatDuration, readDailyStats, readLocal, recordDailyResult, summarizeDailyStats, validSeconds, writeLocal } from '../utils/dailyStats.js';
import './DailyResults.css';

// Icons remain available in every mode. Only daily sessions record results
// or run the shared clock; existing game timers remain authoritative.
export default function DailyResults({ daily, date = new Date().toISOString().slice(0, 10), ...props }) {
  return <DailySession key={`${props.gameId}:${date}:${daily}`} daily={daily} date={date} {...props} />;
}

function DailySession({ gameId, title, date, daily, finished, won = true, seconds, ready = true,
  manualOpen = false, onClose, legacyStats }) {
  const [stats, setStats] = useState(() => readDailyStats(gameId));
  const [open, setOpen] = useState(false);
  const [clock, setClock] = useState(() => {
    const saved = readLocal(clockKey(gameId, date), 0);
    return validSeconds(saved) ? saved : 0;
  });
  const elapsed = useRef(clock);
  const handled = useRef(false);
  const hasTimer = seconds !== undefined;

  useEffect(() => {
    if (!daily || hasTimer || finished || !ready || stats.results[date]) return;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      if (document.visibilityState !== 'hidden') elapsed.current += (now - last) / 1000;
      last = now;
      writeLocal(clockKey(gameId, date), elapsed.current);
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
      writeLocal(clockKey(gameId, date), elapsed.current);
    };
  }, [gameId, date, daily, finished, ready, hasTimer, stats]);

  useEffect(() => {
    if (!daily || !finished || !ready) { handled.current = false; return; }
    if (handled.current) return;
    // Let the game's completion render settle; cleanup cancels stale mode
    // transitions and StrictMode's first effect run.
    const timer = setTimeout(() => {
      handled.current = true;
      const time = hasTimer ? seconds : elapsed.current >= 1 ? elapsed.current : null;
      setStats(recordDailyResult(gameId, date, won, time));
      setOpen(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [gameId, date, daily, finished, ready, won, seconds, hasTimer]);

  const visible = open || (daily && manualOpen);
  const close = () => { setOpen(false); onClose?.(); };
  const summary = summarizeDailyStats(stats, date);
  const result = stats.results[date];
  return <>
    <GameToolbar gameId={gameId} title={title} onStats={() => { setStats(readDailyStats(gameId)); setOpen(true); }}>
      {daily && !hasTimer && <span aria-label="Daily elapsed time">Time: {formatDuration(result?.seconds ?? clock)}</span>}
    </GameToolbar>
    {visible && <GameModal titleId={`daily-title-${gameId}`} onClose={close}>
        <p className="daily-results-eyebrow">{title} · {date}</p>
        <h2 id={`daily-title-${gameId}`}>{result ? result.won ? 'Daily puzzle complete!' : 'Daily game finished' : 'Your daily statistics'}</h2>
        {result && <div className="daily-results-time"><span>{result.won ? 'Completion time' : 'Time played'}</span><strong>{formatDuration(result.seconds)}</strong></div>}
        <div className="daily-results-grid">
          {[[summary.played, 'Finished'], [summary.wins, 'Wins'], [`${summary.winRate}%`, 'Win rate'],
            [summary.currentStreak, 'Current streak'], [summary.maxStreak, 'Best streak'],
            [summary.bestTime === null ? '—' : formatDuration(summary.bestTime), 'Best solve'],
            [summary.averageTime === null ? '—' : formatDuration(summary.averageTime), 'Average solve']].map(([value, label]) =>
            <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
        </div>
        {legacyStats?.played > 0 && <details className="daily-results-legacy"><summary>Legacy local statistics</summary>
          <p>{legacyStats.played} games in the original statistics. These totals may include replays or practice and are kept separate from dated daily results.</p>
          {legacyStats.wins != null && <p>Wins: {legacyStats.wins}</p>}
          {(legacyStats.maxStreak ?? legacyStats.streak) != null && <p>Recorded streak: {legacyStats.maxStreak ?? legacyStats.streak}</p>}
          {legacyStats.bestTime != null && <p>Best time: {formatDuration(legacyStats.bestTime)}</p>}
          {legacyStats.guessDistribution && <p>Guess distribution: {Object.entries(legacyStats.guessDistribution).map(([guesses, count]) => `${guesses} guesses: ${count}`).join(' · ')}</p>}
        </details>}
        <p className="daily-results-note">Saved in this browser. Only your first result each day counts. Streaks require consecutive daily wins; solve times include wins only.</p>
    </GameModal>}
  </>;
}
