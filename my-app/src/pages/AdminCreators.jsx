import { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { firebaseConfigured, firebaseServices } from '../services/firebase.js';
import { createInvite, deleteInvite, inviteLink, listCreators, listInvites, removeCreator, updateCreator } from '../services/creator.js';
import { accessSummary } from '../utils/creatorAccess.js';
import { addDays, gauntletDay, gauntletLaunched, gauntletLineup } from '../gauntlet/gauntlet.js';
import Navbar from '../components/Navbar';
import './AdminArchive.css';
import './AdminCreators.css';

// Hidden admin page: invite creators (people you film content with) and
// choose which gauntlets each one can open before it goes live. Creators also
// get the "Show playing area for filming" preview on the gauntlet page.
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

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" onClick={async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { window.prompt('Copy this link:', text); }
  }}>{copied ? 'Copied!' : 'Copy link'}</button>;
}

export default function AdminCreators() {
  const [user, setUser] = useState(undefined);
  const allowed = !!user && !user.isAnonymous && ADMIN_UIDS.includes(user.uid);
  const today = gauntletDay();
  // Today's gauntlet is open to everyone, so the choice starts tomorrow.
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i + 1)).filter(day => gauntletLaunched(day));
  const [creators, setCreators] = useState(null);
  const [invites, setInvites] = useState(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ name: '', allDays: false, days: [] });
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null);
  const [editing, setEditing] = useState(null); // { uid, name, allDays, days }
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    if (!firebaseConfigured) return undefined;
    return onAuthStateChanged(firebaseServices().auth, setUser);
  }, []);
  const load = useCallback(() => {
    Promise.all([listCreators(), listInvites()])
      .then(([people, codes]) => { setCreators(people); setInvites(codes); setError(''); })
      .catch(failure => setError(failed('load creators', failure)));
  }, []);
  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  async function makeInvite(event) {
    event.preventDefault();
    setBusy(true); setMade(null);
    try { setMade(await createInvite(draft)); setDraft({ name: '', allDays: false, days: [] }); load(); }
    catch (failure) { setError(failed('make the invite', failure)); }
    finally { setBusy(false); }
  }
  async function saveEdit() {
    try { await updateCreator(editing.uid, editing); setEditing(null); load(); }
    catch (failure) { setError(failed('save the changes', failure)); }
  }
  async function remove(uid) {
    try { await removeCreator(uid); setRemoving(null); load(); }
    catch (failure) { setError(failed('remove the creator', failure)); }
  }
  async function cancelInvite(code) {
    try { await deleteInvite(code); load(); }
    catch (failure) { setError(failed('delete the invite', failure)); }
  }

  const draftReady = draft.name.trim() && (draft.allDays || draft.days.length);
  const creatorName = uid => creators?.find(creator => creator.uid === uid)?.name;

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
      recording. Their early runs stay on their own device: they don't publish a time to beat or go on any leaderboard. Make an invite, send the link,
      and once they open it and sign in, they appear under Creators. Each link works once.</p>
    {error && <p role="alert" className="creator-error">{error}</p>}

    <section className="creator-panel" aria-labelledby="creator-new">
      <h2 id="creator-new">New invite</h2>
      <form onSubmit={makeInvite}>
        <label className="creator-name">Who it's for <input value={draft.name} maxLength={60} placeholder="e.g. Sam (YouTube)"
          onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <AccessEditor value={draft} onChange={next => setDraft({ ...draft, ...next })} days={days} />
        <button type="submit" className="creator-primary" disabled={!draftReady || busy}>{busy ? 'Making…' : 'Make invite link'}</button>
      </form>
      {made && <div className="creator-made" role="status">
        <p>Invite for <strong>{made.name}</strong> ({accessSummary(made, today)}). Send them this link:</p>
        <p><code>{inviteLink(made.code)}</code> <CopyButton text={inviteLink(made.code)} /></p>
      </div>}
    </section>

    <section className="creator-panel" aria-labelledby="creator-list">
      <h2 id="creator-list">Creators</h2>
      {creators === null ? <p>Loading…</p> : !creators.length ? <p className="admin-archive-note">No creators yet.</p>
        : <div className="admin-archive-scroll"><table>
          <thead><tr><th>Name</th><th>Account</th><th>Can open early</th><th>Joined</th><th /></tr></thead>
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

    <section className="creator-panel" aria-labelledby="creator-invites">
      <h2 id="creator-invites">Invites</h2>
      {invites === null ? <p>Loading…</p> : !invites.length ? <p className="admin-archive-note">No invites yet.</p>
        : <div className="admin-archive-scroll"><table>
          <thead><tr><th>For</th><th>Gives</th><th>Status</th><th /></tr></thead>
          <tbody>{invites.map(invite => <tr key={invite.code}>
            <td><strong>{invite.name}</strong><br /><small>{invite.createdAt ? `Made ${new Date(invite.createdAt).toLocaleDateString()}` : ''}</small></td>
            <td className="creator-wrap">{accessSummary(invite, today)}</td>
            <td>{invite.usedBy ? <>Used by {creatorName(invite.usedBy) || invite.usedEmail || 'a removed creator'}</> : <span className="creator-waiting">Not used yet</span>}</td>
            <td className="creator-actions">
              {!invite.usedBy && <CopyButton text={inviteLink(invite.code)} />}
              <button type="button" onClick={() => cancelInvite(invite.code)}>{invite.usedBy ? 'Clear' : 'Cancel invite'}</button>
            </td>
          </tr>)}</tbody>
        </table></div>}
      <p className="admin-archive-note">Cancelling an unused invite stops its link working. Clearing a used one only tidies this list: to take access
        away, use Remove under Creators.</p>
    </section>
    <p className="admin-archive-note"><Link to="/admin">Admin home</Link> · <Link to="/admin/gauntlets">Upcoming gauntlets</Link> · <Link to="/creator">The creator page</Link></p>
  </>;

  return <main className="admin-archive admin-creators">
    <Navbar />
    <h1>Creators</h1>
    {body}
  </main>;
}
