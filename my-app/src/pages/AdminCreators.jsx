import { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { firebaseConfigured, firebaseServices } from '../services/firebase.js';
import { findPlayers, listCreators, makeCreator, removeCreator, updateCreator } from '../services/creator.js';
import { friendlyError } from '../services/gauntletBoard.js';
import { accessSummary } from '../utils/creatorAccess.js';
import { addDays, gauntletDay, gauntletLaunched, gauntletLineup } from '../gauntlet/gauntlet.js';
import Navbar from '../components/Navbar';
import './AdminArchive.css';
import './AdminCreators.css';

// Hidden admin page: make a player's existing account a creator account
// (people you film content with) and choose which gauntlets each one is
// invited to play before they go live (also from /admin/gauntlets).
// Creators also get the "Show playing area for filming" preview.
const ADMIN_UIDS = (import.meta.env.VITE_ADMIN_UIDS || '').split(',').map(id => id.trim()).filter(Boolean);
const DAYS_AHEAD = 60;
const dayLabel = day => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const failed = (what, error) => `Couldn't ${what}${error?.code ? ` (${error.code})` : ''}. Check that the Firestore rules are deployed.`;

// "All upcoming gauntlets" or a pick of days.
function AccessEditor({ value, onChange, days }) {
  const group = useId();
  const toggle = day => onChange({ ...value, days: value.days.includes(day) ? value.days.filter(d => d !== day) : [...value.days, day] });
  return <div className="creator-access">
    <label><input type="radio" name={group} checked={value.allDays} onChange={() => onChange({ ...value, allDays: true })} /> All upcoming gauntlets</label>
    <label><input type="radio" name={group} checked={!value.allDays} onChange={() => onChange({ ...value, allDays: false })} /> Only the gauntlets I pick</label>
    {!value.allDays && <ul className="creator-days" aria-label="Gauntlets this creator can open early">
      {days.map(day => <li key={day}>
        <label title={gauntletLineup(day).map(game => game.title).join(', ')}>
          <input type="checkbox" checked={value.days.includes(day)} onChange={() => toggle(day)} />
          <span>{dayLabel(day)}</span>
        </label>
      </li>)}
    </ul>}
  </div>;
}

export default function AdminCreators() {
  const [user, setUser] = useState(undefined);
  const allowed = !!user && !user.isAnonymous && ADMIN_UIDS.includes(user.uid);
  const today = gauntletDay();
  // Today's gauntlet is open to everyone, so the choice starts tomorrow.
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i + 1)).filter(day => gauntletLaunched(day));
  const [creators, setCreators] = useState(null);
  const [error, setError] = useState('');
  // Finding an account to make a creator.
  const [query, setQuery] = useState('');
  const [found, setFound] = useState(null); // null | 'searching' | [players]
  const [searchError, setSearchError] = useState('');
  const [adding, setAdding] = useState(null); // { uid, email, name, allDays, days }
  const [editing, setEditing] = useState(null); // { uid, name, allDays, days }
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    if (!firebaseConfigured) return undefined;
    return onAuthStateChanged(firebaseServices().auth, setUser);
  }, []);
  const load = useCallback(() => {
    listCreators()
      .then(people => { setCreators(people); setError(''); })
      .catch(failure => setError(failed('load creators', failure)));
  }, []);
  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  async function search(event) {
    event.preventDefault();
    setFound('searching'); setSearchError(''); setAdding(null);
    try { setFound(await findPlayers(query)); }
    catch (failure) { setFound(null); setSearchError(friendlyError(failure)); }
  }
  async function add() {
    try {
      await makeCreator(adding);
      setFound(current => Array.isArray(current) ? current.map(person => (person.uid === adding.uid ? { ...person, creator: true } : person)) : current);
      setAdding(null); load();
    } catch (failure) { setError(failed('make the creator', failure)); }
  }
  async function saveEdit() {
    try { await updateCreator(editing.uid, editing); setEditing(null); load(); }
    catch (failure) { setError(failed('save the changes', failure)); }
  }
  async function remove(uid) {
    try { await removeCreator(uid); setRemoving(null); load(); }
    catch (failure) { setError(failed('remove the creator', failure)); }
  }
  const addReady = adding && adding.name.trim();

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
    <p className="admin-archive-note">Creators can play the gauntlets you choose before they go live, and use the playing-area preview to line up their
      recording. Their early runs stay on their own device: they don't publish a time to beat or go on any leaderboard. To add someone, have them
      sign in on the site (and pick a nickname), then find their account below. You can also invite creators to a day from Upcoming gauntlets.
      Creators see their invitations in their account menu.</p>
    {error && <p role="alert" className="creator-error">{error}</p>}

    <section className="creator-panel" aria-labelledby="creator-new">
      <h2 id="creator-new">Add a creator</h2>
      <form className="creator-search" onSubmit={search}>
        <label className="creator-name">Find their account <input value={query} onChange={event => setQuery(event.target.value)}
          placeholder="Nickname or sign-in email" autoComplete="off" /></label>
        <button type="submit" disabled={query.trim().length < 2 || found === 'searching'}>{found === 'searching' ? 'Searching…' : 'Search'}</button>
      </form>
      {searchError && <p role="alert" className="creator-error">{searchError}</p>}
      {Array.isArray(found) && (!found.length
        ? <p className="admin-archive-note">No account found. Check the spelling, or ask them to sign in on the site and choose a nickname first.</p>
        : <ul className="creator-found">{found.map(person => <li key={person.uid}>
          <span><strong>{person.nickname || person.name || 'No nickname yet'}</strong> <small>{person.email || person.uid}</small></span>
          {person.creator ? <span className="creator-tag">Creator</span>
            : adding?.uid === person.uid ? null
              : <button type="button" onClick={() => setAdding({ uid: person.uid, email: person.email, name: person.nickname || person.name || '', allDays: false, days: [] })}>Make creator</button>}
        </li>)}</ul>)}
      {adding && <div className="creator-made">
        <label className="creator-name">Name to show <input value={adding.name} maxLength={60} placeholder="e.g. Sam (YouTube)"
          onChange={event => setAdding({ ...adding, name: event.target.value })} /></label>
        <p className="admin-archive-note">Invite them to gauntlets now, or later (here or from Upcoming gauntlets).</p>
        <AccessEditor value={adding} onChange={next => setAdding({ ...adding, ...next })} days={days} />
        <div className="creator-actions">
          <button type="button" className="creator-primary" onClick={add} disabled={!addReady}>Make creator</button>
          <button type="button" onClick={() => setAdding(null)}>Cancel</button>
        </div>
      </div>}
    </section>

    <section className="creator-panel" aria-labelledby="creator-list">
      <h2 id="creator-list">Creators</h2>
      {creators === null ? <p>Loading…</p> : !creators.length ? <p className="admin-archive-note">No creators yet.</p>
        : <div className="admin-archive-scroll"><table>
          <thead><tr><th>Name</th><th>Account</th><th>Invited to</th><th>Joined</th><th /></tr></thead>
          <tbody>{creators.map(creator => editing?.uid === creator.uid
            ? <tr key={creator.uid} className="creator-editing"><td colSpan={5}>
              <label className="creator-name">Name <input value={editing.name} maxLength={60} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label>
              <AccessEditor value={editing} onChange={next => setEditing({ ...editing, ...next })} days={days} />
              <button type="button" className="creator-primary" onClick={saveEdit} disabled={!editing.name.trim()}>Save</button>{' '}
              <button type="button" onClick={() => setEditing(null)}>Cancel</button>
            </td></tr>
            : <tr key={creator.uid}>
              <td><strong>{creator.name}</strong></td>
              <td>{creator.email || <small>{creator.uid}</small>}</td>
              <td className="creator-wrap">{accessSummary(creator, today)}</td>
              <td>{creator.joinedAt ? new Date(creator.joinedAt).toLocaleDateString() : ''}</td>
              <td className="creator-actions">
                <button type="button" onClick={() => setEditing({ uid: creator.uid, name: creator.name || '', allDays: !!creator.allDays, days: (creator.days || []).filter(day => day > today) })}>Edit access</button>
                {removing === creator.uid
                  ? <><button type="button" className="creator-danger" onClick={() => remove(creator.uid)}>Confirm remove</button> <button type="button" onClick={() => setRemoving(null)}>Keep</button></>
                  : <button type="button" onClick={() => setRemoving(creator.uid)}>Remove</button>}
              </td>
            </tr>)}</tbody>
        </table></div>}
    </section>

    <p className="admin-archive-note"><Link to="/admin">Admin home</Link> · <Link to="/admin/gauntlets">Upcoming gauntlets</Link> · <Link to="/creator">The creator page</Link></p>
  </>;

  return <main className="admin-archive admin-creators">
    <Navbar />
    <h1>Creators</h1>
    {body}
  </main>;
}
