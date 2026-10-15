import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { firebaseConfigured, firebaseServices } from '../services/firebase.js';
import { readPar } from '../services/gauntletPar.js';
import { PAR_NAME, addDays, formatClock, gauntletDay, gauntletLaunched, gauntletLineup, gauntletOpensAt, validPar } from '../gauntlet/gauntlet.js';
import ChiliRating from '../components/ChiliRating';
import Navbar from '../components/Navbar';
import './AdminArchive.css';

// Hidden admin page: today's and the coming Skeeter Gauntlets, with whether
// the owner's time to beat is recorded for each. Play opens a future
// gauntlet early (/gauntlet?day=…), so videos can be filmed in advance and
// every day has a time to beat as soon as it opens.
const ADMIN_UIDS = (import.meta.env.VITE_ADMIN_UIDS || '').split(',').map(id => id.trim()).filter(Boolean);
const DAYS_AHEAD = 28;

const dayLabel = day => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

export default function AdminGauntlets() {
  const [user, setUser] = useState(undefined);
  const [pars, setPars] = useState({});
  const [error, setError] = useState('');
  const today = gauntletDay();
  const days = Array.from({ length: DAYS_AHEAD + 1 }, (_, i) => addDays(today, i)).filter(day => gauntletLaunched(day));
  const allowed = !!user && !user.isAnonymous && ADMIN_UIDS.includes(user.uid);

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(firebaseServices().auth, setUser);
  }, []);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    Promise.all(days.map(day => readPar(day).then(par => [day, validPar(par, day)])))
      .then(entries => { if (active) setPars(Object.fromEntries(entries)); })
      .catch(failure => { if (active) setError(`Could not load recorded times${failure?.code ? ` (${failure.code})` : ''}.`); });
    return () => { active = false; };
  }, [allowed, today]);

  const recorded = days.filter(day => pars[day]).length;
  const nextMissing = days.find(day => day in pars && !pars[day]);

  let body;
  if (!firebaseConfigured) body = <p>Firebase is not configured for this build.</p>;
  else if (user === undefined) body = <p>Checking sign-in…</p>;
  else if (!user || user.isAnonymous) body = <>
    <p>Sign in to view this page.</p>
    <button type="button" onClick={() => signInWithPopup(firebaseServices().auth, new GoogleAuthProvider()).catch(() => {})}>Sign in with Google</button>
  </>;
  else if (!allowed) body = <>
    <p>This account does not have access.</p>
    <button type="button" onClick={() => signOut(firebaseServices().auth)}>Sign out</button>
  </>;
  else body = <>
    <p className="admin-archive-note">Play a gauntlet before it opens to record {PAR_NAME}'s time to beat. When you finish, your time is published for that day
      and your run is posted to that day's leaderboard, as if you'd played it when it opened. Each new gauntlet opens at {new Date(gauntletOpensAt(today)).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} your time.</p>
    {error && <p role="alert">{error}</p>}
    <p>{recorded} of {days.length} recorded{nextMissing ? <> · next without a time: <strong>{dayLabel(nextMissing)}</strong></> : ''}</p>
    <div className="admin-archive-scroll">
      <table>
        <thead><tr><th>Day</th><th>Lineup</th><th>{PAR_NAME}'s time</th><th /></tr></thead>
        <tbody>{days.map(day => {
          const par = pars[day];
          return <tr key={day} className={day === today ? 'admin-gauntlet-today' : ''}>
            <td><strong>{dayLabel(day)}</strong>{day === today && <span className="admin-gauntlet-tag">Today</span>}<br /><small>{day}</small></td>
            <td><ol className="admin-gauntlet-lineup">{gauntletLineup(day).map(game => <li key={game.id}>{game.title} <ChiliRating level={game.level} /></li>)}</ol></td>
            <td>{!(day in pars) ? '…' : par ? <><strong className="admin-gauntlet-time">{formatClock(par.total)}</strong><br /><small>{par.solved} of {par.results.length} solved</small></> : <span className="admin-gauntlet-missing">Not recorded</span>}</td>
            <td><Link className="admin-gauntlet-play" to={day === today ? '/gauntlet' : `/gauntlet?day=${day}`}>{par ? 'Replay' : 'Play'}</Link></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <p className="admin-archive-note">Replaying a future gauntlet and finishing it replaces its published time. On the day itself, a recorded time is kept
      unless you press Publish my time after a new run. Use "Restart this gauntlet" in the yellow bar to clear a run and start over. <Link to="/admin">Admin home</Link> · <Link to="/admin/stats">Player stats</Link> · <Link to="/admin/archive">Puzzle archive admin</Link></p>
  </>;

  return <main className="admin-archive admin-gauntlets">
    <Navbar />
    <h1>Upcoming gauntlets</h1>
    {body}
  </main>;
}
