import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { onIdTokenChanged, signOut } from 'firebase/auth';
import { firebaseConfigured, firebaseServices } from '../services/firebase.js';
import { watchCreator } from '../services/creator.js';
import { watchOwner } from '../services/gauntletPar.js';
import { previewDays } from '../utils/creatorAccess.js';
import { useCustomGauntlets } from '../services/customGauntlets.js';
import { addDays, customGauntlet, gauntletDay, gauntletLaunched, gauntletLineup, gauntletOpensAt } from '../gauntlet/gauntlet.js';
import ChiliRating from '../components/ChiliRating';
import Navbar from '../components/Navbar';
import SignInDialog from '../components/SignInDialog';
import './AdminArchive.css';
import './AdminCreators.css';

// The creator page (/creator), for accounts the owner has made creators at
// /admin/creators. It lists the gauntlets they're invited to play early.
const DAYS_AHEAD = 60;
const dayLabel = day => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

export default function CreatorHome() {
  const [user, setUser] = useState(firebaseConfigured ? undefined : null);
  const [creator, setCreator] = useState(undefined);
  const [owner, setOwner] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const custom = useCustomGauntlets();

  useEffect(() => {
    if (!firebaseConfigured) return undefined;
    return onIdTokenChanged(firebaseServices().auth, next => setUser(next && !next.isAnonymous ? next : null));
  }, []);
  useEffect(() => watchCreator(setCreator), []);
  useEffect(() => watchOwner(setOwner), []);

  const today = gauntletDay();
  const upcoming = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i + 1)).filter(day => gauntletLaunched(day));
  const days = creator ? previewDays(creator, upcoming) : [];
  const opensAt = new Date(gauntletOpensAt(today)).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  let body;
  if (!firebaseConfigured) body = <p>Accounts aren't set up on this build.</p>;
  else if (user === undefined || (user && creator === undefined) || custom.state === 'loading') body = <p>Checking sign-in…</p>;
  else if (!user) body = <section className="creator-panel">
    <h2>Creators</h2>
    <p>This page is for creators filming with Skeeter Games. Sign in with your creator account.</p>
    <button type="button" className="creator-primary" onClick={() => setSigningIn(true)}>Sign in</button>
  </section>;
  else if (!creator) body = <section className="creator-panel">
    <p>This account isn't a creator account. {owner ? <>You're the owner: make creators from <Link to="/admin/creators">Creators admin</Link>.</>
      : 'If you\'re working with Skeeter Games, send us the nickname or email you sign in with and we\'ll set it up.'}</p>
    <p className="admin-archive-note">Signed in as {user.email || user.displayName || 'this account'}.{' '}
      <button type="button" onClick={() => signOut(firebaseServices().auth)}>Use another account</button></p>
  </section>;
  else body = <>
    <p>Welcome, <strong>{creator.name}</strong><span className="creator-tag">Creator</span></p>
    <section className="creator-panel" aria-labelledby="creator-days">
      <h2 id="creator-days">Gauntlets you're invited to play early</h2>
      {!days.length ? <p className="admin-archive-note">No invitations right now. When you're invited to a gauntlet, it'll show up here and in your account menu.</p>
        : <div className="admin-archive-scroll admin-gauntlets"><table>
          <thead><tr><th>Day</th><th>Lineup</th><th /></tr></thead>
          <tbody>{days.map(day => <tr key={day}>
            <td><strong>{dayLabel(day)}</strong><br /><small>Goes live {new Date(gauntletOpensAt(day)).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></td>
            <td>{customGauntlet(day) && <p className="custom-title">{customGauntlet(day).title}</p>}
              <ol className="admin-gauntlet-lineup">{gauntletLineup(day).map(game => <li key={game.id}>{game.title} <ChiliRating level={game.level} /></li>)}</ol></td>
            <td><Link className="admin-gauntlet-play" to={`/gauntlet?day=${day}`}>Play</Link></td>
          </tr>)}</tbody>
        </table></div>}
      <p className="admin-archive-note">Today's gauntlet is open to everyone: <Link to="/gauntlet">play today's gauntlet</Link>. A new one opens every day at {opensAt} your time.</p>
    </section>
    <section className="creator-panel" aria-labelledby="creator-filming">
      <h2 id="creator-filming">Filming tips</h2>
      <ul className="creator-tools">
        <li><strong>Line up your recording</strong>Before you start a gauntlet, press "Show playing area for filming": it shows the bar and the box every game appears
          in, so you can frame your capture. Press Start there when you're ready.</li>
        <li><strong>Your runs count</strong>When you finish an early gauntlet, your run goes on that day's leaderboard as if you'd played it when it
          opened. On a gauntlet named after you, your time also shows under Skeeter's as one to beat.</li>
        <li><strong>Practice freely</strong><Link to="/gauntlet?test=1">Test gauntlets</Link> can be replayed as often as you like: good for a warm-up or
          checking your setup.</li>
        <li><strong>Don't spoil it</strong>Please don't share an early gauntlet's puzzles or lineup before it goes live.</li>
      </ul>
    </section>
    <p className="admin-archive-note">Signed in as {creator.email || user.email || 'this account'}.{' '}
      <button type="button" onClick={() => signOut(firebaseServices().auth)}>Sign out</button></p>
  </>;

  return <main className="admin-archive creator-home">
    <Navbar />
    <h1>Creator corner</h1>
    {body}
    {signingIn && <SignInDialog onClose={() => setSigningIn(false)} reason="Sign in to your creator account." />}
  </main>;
}
