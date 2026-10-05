import { useEffect, useMemo, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { firebaseConfigured, firebaseServices } from '../services/firebase.js';
import { puzzleLoggingEnabled, readGameRates } from '../services/puzzleResults.js';
import { ARCHIVE_GAMES } from '../utils/archive.js';
import { GAME_TITLES, buildRows } from '../utils/adminArchive.js';
import { dailyDate } from '../utils/dailyClock.js';
import { formatDuration } from '../utils/dailyStats.js';
import ChiliRating from '../components/ChiliRating';
import './AdminArchive.css';

// Hidden, unlinked page. It only appears for Google accounts whose Firebase
// user ID is listed in VITE_ADMIN_UIDS. This hides the page; the aggregate
// counts it shows are the same public counts the results modal reads.
const ADMIN_UIDS = (import.meta.env.VITE_ADMIN_UIDS || '').split(',').map(id => id.trim()).filter(Boolean);

const percent = value => value === null ? '—' : `${Math.round(value * 100)}%`;
const time = seconds => seconds === null ? '—' : formatDuration(seconds);

export default function AdminArchive() {
  const [user, setUser] = useState(undefined);
  const [game, setGame] = useState(ARCHIVE_GAMES[0]);
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState('');
  const [hardestFirst, setHardestFirst] = useState(true);
  const [hideUnplayed, setHideUnplayed] = useState(false);
  const today = dailyDate();
  const allowed = !!user && !user.isAnonymous && ADMIN_UIDS.includes(user.uid);

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(firebaseServices().auth, setUser);
  }, []);
  useEffect(() => {
    if (!allowed || !puzzleLoggingEnabled) return;
    let active = true;
    setDocs(null); setError('');
    readGameRates(game).then(value => { if (active) setDocs(value); })
      .catch(failure => {
        console.error('Admin archive load failed', failure);
        if (active) setError(`Could not load community results${failure?.code ? ` (${failure.code})` : ''}. ${failure?.code === 'permission-denied'
          ? 'Firestore refused the read: publish firestore.rules (firebase deploy --only firestore:rules) and check the project ID.'
          : failure?.code === 'unavailable' ? 'Check your connection and try again.' : failure?.message || 'Check your connection and try again.'}`);
      });
    return () => { active = false; };
  }, [allowed, game]);

  const rows = useMemo(() => docs ? buildRows(game, docs, today) : [], [docs, game, today]);
  const sorted = useMemo(() => rows.filter(row => !hideUnplayed || row.summary.starts > 0)
    .sort((a, b) => hardestFirst ? a.rank - b.rank : b.rank - a.rank), [rows, hardestFirst, hideUnplayed]);
  const played = rows.filter(row => row.summary.starts > 0).length;

  let body;
  if (!firebaseConfigured) body = <p>Firebase is not configured for this build.</p>;
  else if (user === undefined) body = <p>Checking sign-in…</p>;
  else if (!user || user.isAnonymous) body = <>
    <p>Sign in to view this page.</p>
    <button type="button" onClick={() => signInWithPopup(firebaseServices().auth, new GoogleAuthProvider()).catch(() => {})}>Sign in with Google</button>
  </>;
  else if (!allowed) body = <>
    <p>This account does not have access.</p>
    <p className="admin-archive-note">If this is your account, add this ID to <code>VITE_ADMIN_UIDS</code> and rebuild: <code>{user.uid}</code></p>
    <button type="button" onClick={() => signOut(firebaseServices().auth)}>Sign out</button>
  </>;
  else if (!puzzleLoggingEnabled) body = <p>Community results are not enabled yet. Set <code>VITE_PUZZLE_RESULTS_ENABLED=true</code> after deploying the results function.</p>;
  else body = <>
    <div className="admin-archive-controls">
      <label>Game <select value={game} onChange={event => setGame(event.target.value)}>
        {ARCHIVE_GAMES.map(id => <option key={id} value={id}>{GAME_TITLES[id] || id}</option>)}
      </select></label>
      <button type="button" onClick={() => setHardestFirst(value => !value)}>{hardestFirst ? 'Showing hardest first' : 'Showing easiest first'}</button>
      <label><input type="checkbox" checked={hideUnplayed} onChange={event => setHideUnplayed(event.target.checked)} /> Hide unplayed</label>
    </div>
    {error ? <p role="alert">{error}</p> : !docs ? <p>Loading…</p> : <>
      <p className="admin-archive-note">{played} of {rows.length} puzzles have community results. Daily and archive plays are combined.</p>
      <div className="admin-archive-scroll">
        <table>
          <thead><tr><th>Rank</th><th>Date</th><th>Chili</th><th>Players</th><th>Completed</th><th>Median</th><th>Average</th><th>Score</th><th>Confidence</th><th /></tr></thead>
          <tbody>{sorted.map(row => <tr key={row.date}>
            <td>{row.rank}</td>
            <td>{row.date}{row.date === today && ' (today)'}</td>
            <td><ChiliRating level={row.chili} /></td>
            <td>{row.summary.starts}</td>
            <td>{percent(row.summary.completion)}</td>
            <td>{time(row.summary.medianSeconds)}</td>
            <td>{time(row.summary.averageSeconds)}</td>
            <td>{row.score.toFixed(2)}</td>
            <td>{row.confidence === 'none' ? 'Chili only' : row.confidence}</td>
            <td><a href={`/${game}${row.date === today ? '' : `?date=${row.date}`}`}>Play</a></td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="admin-archive-note">Score compares puzzles within this game: positive is harder than its usual puzzle, negative is easier. It blends how many players failed or gave up with how slow the median solve was. Puzzles with few players lean on the chili rating until about 8 players have tried them.</p>
    </>}
    <button type="button" onClick={() => signOut(firebaseServices().auth)}>Sign out</button>
  </>;

  return <main className="admin-archive">
    <h1>Puzzle difficulty archive</h1>
    {body}
  </main>;
}
