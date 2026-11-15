import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { firebaseConfigured, firebaseServices } from '../services/firebase.js';
import { readPar } from '../services/gauntletPar.js';
import { deleteCustomGauntlet, saveCustomGauntlet, useCustomGauntlets } from '../services/customGauntlets.js';
import { listCreators, updateCreator } from '../services/creator.js';
import { CUSTOM_GAME_IDS, DEFAULT_TITLE, GAUNTLET_SIZE, PAR_NAME, TITLE_MAX, WORD_GAMES, addDays, customGauntlet, formatClock, gameTitle, gauntletDay,
  gauntletLaunched, gauntletLineup, gauntletOpensAt, gauntletPuzzleDate, validPar } from '../gauntlet/gauntlet.js';
import { dailyDifficulty } from '../utils/dailyDifficulty.js';
import ChiliRating from '../components/ChiliRating';
import Navbar from '../components/Navbar';
import './AdminArchive.css';
import './AdminCreators.css';

// Hidden admin page: today's and the coming Skeeter Gauntlets, with whether
// the owner's time to beat is recorded for each. Play opens a future
// gauntlet early (/gauntlet?day=…), so videos can be filmed in advance and
// every day has a time to beat as soon as it opens. Customize swaps a future
// day's games for six of your choice and gives it its own name (for example
// a creator's), stored at customGauntlets/{day}.
const ADMIN_UIDS = (import.meta.env.VITE_ADMIN_UIDS || '').split(',').map(id => id.trim()).filter(Boolean);
const DAYS_AHEAD = 28;

const dayLabel = day => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
// Games offered in the editor, A to Z (any game the gauntlet can play).
const GAME_CHOICES = [...CUSTOM_GAME_IDS].sort((a, b) => gameTitle(a).localeCompare(gameTitle(b)));

function CustomEditor({ day, creators, hasPar, onDone, onSaved }) {
  const existing = customGauntlet(day);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [games, setGames] = useState(() => gauntletLineup(day).map(game => game.id));
  const [creator, setCreator] = useState('');
  const [status, setStatus] = useState('');
  const puzzleDate = gauntletPuzzleDate(day);
  const repeats = games.filter((id, i) => games.indexOf(id) !== i);
  const words = games.filter(id => WORD_GAMES.includes(id)).length;
  const changedGames = games.join() !== gauntletLineup(day).map(game => game.id).join();
  const pickable = creators.filter(person => !person.allDays && !(person.days || []).includes(day));

  async function save() {
    setStatus('Saving…');
    try {
      await saveCustomGauntlet(day, { title: title.trim() || DEFAULT_TITLE, games });
      const person = creators.find(entry => entry.uid === creator);
      if (person) await updateCreator(person.uid, { name: person.name || '', allDays: false, days: [...(person.days || []), day] });
      onSaved();
    } catch (failure) {
      setStatus(`Couldn't save${failure?.code ? ` (${failure.code})` : ''}. Check that the Firestore rules are deployed.`);
    }
  }
  async function remove() {
    setStatus('Removing…');
    try { await deleteCustomGauntlet(day); onSaved(); }
    catch (failure) { setStatus(`Couldn't remove it${failure?.code ? ` (${failure.code})` : ''}.`); }
  }

  return <div className="custom-editor">
    <label className="creator-name">Name for the day <input value={title} maxLength={TITLE_MAX} placeholder={`e.g. Sam's Gauntlet (blank: ${DEFAULT_TITLE})`}
      onChange={event => setTitle(event.target.value)} /></label>
    <ol className="custom-games">
      {games.map((id, i) => <li key={i}>
        <span className="custom-num">{i + 1}</span>
        <select aria-label={`Game ${i + 1}`} value={id} className={repeats.includes(id) ? 'repeat' : ''}
          onChange={event => setGames(games.map((old, j) => (j === i ? event.target.value : old)))}>
          {GAME_CHOICES.map(choice => <option key={choice} value={choice}>{gameTitle(choice)}</option>)}
        </select>
        <ChiliRating level={dailyDifficulty(id, puzzleDate)} />
      </li>)}
    </ol>
    <p className="admin-archive-note">Games play in this order. Each one's spice level is set by the day, as usual.
      {words !== 2 && ` This lineup has ${words} word ${words === 1 ? 'game' : 'games'} (normally 2).`}</p>
    {repeats.length > 0 && <p className="creator-error">Each game can only be in the lineup once ({[...new Set(repeats)].map(gameTitle).join(', ')} is repeated).</p>}
    {hasPar && changedGames && <p className="creator-error">You've recorded a time for this day. With different games it won't count any more: play the day again to record a new one.</p>}
    {pickable.length > 0 && <label className="creator-name">Let a creator play it early
      <select value={creator} onChange={event => setCreator(event.target.value)}>
        <option value="">No one else</option>
        {pickable.map(person => <option key={person.uid} value={person.uid}>{person.name}</option>)}
      </select></label>}
    <div className="creator-actions">
      <button type="button" className="creator-primary" onClick={save} disabled={repeats.length > 0 || games.length !== GAUNTLET_SIZE || /…/.test(status)}>
        {existing ? 'Save changes' : 'Make this a custom gauntlet'}</button>
      <button type="button" onClick={onDone}>Cancel</button>
      {existing && <button type="button" className="creator-danger" onClick={remove}>Back to the usual games</button>}
    </div>
    {status && <p role="status">{status}</p>}
  </div>;
}

export default function AdminGauntlets() {
  const [user, setUser] = useState(undefined);
  const [pars, setPars] = useState({});
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [creators, setCreators] = useState([]);
  const custom = useCustomGauntlets();
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
    Promise.all(days.map(day => readPar(day).then(par => [day, par])))
      .then(entries => { if (active) setPars(Object.fromEntries(entries)); })
      .catch(failure => { if (active) setError(`Could not load recorded times${failure?.code ? ` (${failure.code})` : ''}.`); });
    listCreators().then(list => { if (active) setCreators(list); }).catch(() => {});
    return () => { active = false; };
  }, [allowed, today]);

  // A recorded time counts only if it matches the day's games (which a custom
  // gauntlet can change), so check it against the current lineups.
  const valid = Object.fromEntries(Object.entries(pars).map(([day, par]) => [day, validPar(par, day)]));
  const recorded = days.filter(day => valid[day]).length;
  const nextMissing = days.find(day => day in valid && !valid[day]);

  let body;
  if (!firebaseConfigured) body = <p>Firebase is not configured for this build.</p>;
  else if (user === undefined || custom.state === 'loading') body = <p>Loading…</p>;
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
      and your run is posted to that day's leaderboard, as if you'd played it when it opened. Each new gauntlet opens at {new Date(gauntletOpensAt(today)).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} your time.
      Customize gives a future day six games of your choice and its own name, for example a creator's.</p>
    {error && <p role="alert">{error}</p>}
    {custom.state === 'error' && <p role="alert" className="creator-error">Couldn't load custom gauntlets. <button type="button" onClick={custom.reload}>Try again</button></p>}
    <p>{recorded} of {days.length} recorded{nextMissing ? <> · next without a time: <strong>{dayLabel(nextMissing)}</strong></> : ''}</p>
    <div className="admin-archive-scroll">
      <table>
        <thead><tr><th>Day</th><th>Lineup</th><th>{PAR_NAME}'s time</th><th /></tr></thead>
        <tbody>{days.map(day => {
          const par = valid[day];
          const special = customGauntlet(day);
          if (editing === day) return <tr key={day} className="creator-editing"><td colSpan={4}>
            <strong>{dayLabel(day)}</strong> <small>{day}</small>
            <CustomEditor day={day} creators={creators} hasPar={!!par} onDone={() => setEditing(null)}
              onSaved={() => { setEditing(null); custom.reload(); listCreators().then(setCreators).catch(() => {}); }} />
          </td></tr>;
          return <tr key={day} className={day === today ? 'admin-gauntlet-today' : ''}>
            <td><strong>{dayLabel(day)}</strong>{day === today && <span className="admin-gauntlet-tag">Today</span>}<br /><small>{day}</small></td>
            <td>{special && <p className="custom-title">{special.title}<span className="creator-tag">Custom</span></p>}
              <ol className="admin-gauntlet-lineup">{gauntletLineup(day).map(game => <li key={game.id}>{game.title} <ChiliRating level={game.level} /></li>)}</ol></td>
            <td>{!(day in pars) ? '…' : par ? <><strong className="admin-gauntlet-time">{formatClock(par.total)}</strong><br /><small>{par.solved} of {par.results.length} solved</small></> : <span className="admin-gauntlet-missing">Not recorded</span>}</td>
            <td className="custom-actions">
              <Link className="admin-gauntlet-play" to={day === today ? '/gauntlet' : `/gauntlet?day=${day}`}>{par ? 'Replay' : 'Play'}</Link>
              {day > today && custom.state === 'ready' && <button type="button" onClick={() => setEditing(day)}>{special ? 'Edit custom' : 'Customize'}</button>}
            </td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <p className="admin-archive-note">Replaying a future gauntlet and finishing it replaces its published time. On the day itself, a recorded time is kept
      unless you press Publish my time after a new run. Use "Restart this gauntlet" in the yellow bar to clear a run and start over. A gauntlet can be
      customized until the day it opens. <Link to="/admin">Admin home</Link> · <Link to="/admin/creators">Creators</Link> · <Link to="/admin/stats">Player stats</Link> · <Link to="/admin/archive">Puzzle archive admin</Link></p>
  </>;

  return <main className="admin-archive admin-gauntlets">
    <Navbar />
    <h1>Upcoming gauntlets</h1>
    {body}
  </main>;
}
