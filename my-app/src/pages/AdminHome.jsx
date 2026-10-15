import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { firebaseConfigured, firebaseServices } from '../services/firebase.js';
import Navbar from '../components/Navbar';
import './AdminArchive.css';
import './AdminHome.css';

// Hidden admin home: links to every admin page. Only the owner's account
// sees the links (the homepage shows an Admin link to that account only).
const ADMIN_UIDS = (import.meta.env.VITE_ADMIN_UIDS || '').split(',').map(id => id.trim()).filter(Boolean);

const PAGES = [
  { to: '/admin/stats', title: 'Player stats', text: 'Players with nicknames, who plays what, and which games are trending.' },
  { to: '/admin/gauntlets', title: 'Upcoming gauntlets', text: 'Play future gauntlets early to record your time to beat.' },
  { to: '/admin/archive', title: 'Puzzle archive', text: 'Community results for every past daily puzzle, hardest first.' },
  { to: '/gauntlet?test=1', title: 'Test gauntlets', text: 'Replayable practice gauntlets, never published or ranked.' },
];

export default function AdminHome() {
  const [user, setUser] = useState(undefined);
  const allowed = !!user && !user.isAnonymous && ADMIN_UIDS.includes(user.uid);
  useEffect(() => {
    if (!firebaseConfigured) return undefined;
    return onAuthStateChanged(firebaseServices().auth, setUser);
  }, []);

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
  else body = <ul className="admin-home-grid">
    {PAGES.map(page => <li key={page.to}><Link to={page.to}><strong>{page.title}</strong><span>{page.text}</span></Link></li>)}
  </ul>;

  return <main className="admin-archive admin-home">
    <Navbar />
    <h1>Admin</h1>
    {body}
  </main>;
}
