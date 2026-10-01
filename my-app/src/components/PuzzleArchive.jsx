import { useEffect, useState } from 'react';
import GameModal from './GameModal';
import ChiliRating from './ChiliRating';
import PuzzleRate from './PuzzleRate';
import { useArchive } from './DailyBoundary';
import { ARCHIVE_START, validArchiveDate, archiveStatsId, resultSummary } from '../utils/archive.js';
import { readDailyStats } from '../utils/dailyStats.js';
import { dailyDifficulty } from '../utils/dailyDifficulty.js';
import { readPuzzleRate } from '../services/puzzleResults.js';
import './PuzzleArchive.css';

export default function PuzzleArchive({ gameId, title }) {
  const session = useArchive();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(() => session?.archive ? session.date : new Date(Date.now() - 86400000).toISOString().slice(0, 10));
  const [rate, setRate] = useState(null);
  const [rateStatus, setRateStatus] = useState('');
  const today = session?.today;
  const valid = validArchiveDate(selected, today);
  useEffect(() => {
    if (!open || !valid) return;
    let active = true;
    setRate(null); setRateStatus('Loading results…');
    readPuzzleRate(gameId, selected, 'archive').then(value => {
      if (active) { setRate(value); setRateStatus(value ? '' : 'No shared archive attempts recorded yet.'); }
    }).catch(() => { if (active) setRateStatus('Community results are unavailable. You can still play.'); });
    return () => { active = false; };
  }, [open, valid, gameId, selected]);
  if (!session?.archiveEnabled) return null;
  const local = readDailyStats(archiveStatsId(gameId, true)).results[selected];
  const counts = resultSummary(rate);
  return <>
    <button type="button" className="archive-open" onClick={() => setOpen(true)} aria-haspopup="dialog">Archive</button>
    {session.archive && <span className="archive-current">Archive · {session.date} <button type="button" onClick={() => session.selectDate(today)}>Today</button></span>}
    {open && <GameModal titleId="archive-title" onClose={() => setOpen(false)}>
      <h2 id="archive-title">{title} archive</h2>
      <p>Choose a past daily puzzle. Archive results are separate from your daily streak.</p>
      <label className="archive-date">Puzzle date <input type="date" value={selected} min={ARCHIVE_START}
        max={new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)} onChange={event => setSelected(event.target.value)} /></label>
      {valid ? <>
        <p className="archive-rating"><ChiliRating level={dailyDifficulty(gameId, selected)} /> {['Mild', 'Medium', 'Picante'][dailyDifficulty(gameId, selected) - 1]}</p>
        <p>Your archive result: {local ? local.won ? 'Won' : 'Lost' : 'Not completed'}</p>
        <PuzzleRate gameId={gameId} date={selected} mode="daily" />
        <h3>Players on this archive puzzle</h3>
        {rate ? <p>{counts.winRate === null ? '—' : `${counts.winRate}%`} win rate · {counts.starts} started · {counts.wins} won · {counts.losses} lost · {counts.unfinished} unfinished</p> : <p role="status">{rateStatus}</p>}
        <p className="archive-note">Win rate is wins divided by started attempts. Only each player’s first result counts. Archive and live daily attempts are tracked separately.</p>
      </> : <p>Select a date from {ARCHIVE_START} through yesterday.</p>}
      <button className="daily-results-done" disabled={!valid} onClick={() => { setOpen(false); session.selectDate(selected); }}>Play puzzle</button>
      <p className="archive-note">Older puzzles are recreated with the current archive edition and may differ from the original release. Puzzle snapshots and progress are saved in this browser.</p>
    </GameModal>}
  </>;
}
