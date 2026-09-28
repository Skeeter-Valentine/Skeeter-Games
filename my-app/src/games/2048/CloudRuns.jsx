import { useEffect, useRef, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, getDocFromServer, getDocsFromServer, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseConfigured, firebaseServices } from '../../services/firebase';
import { encodeRun, validateRun } from './runSave';
import './CloudRuns.css';

export default function CloudRuns({ snapshot, onLoad, onPause, disabled }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [runs, setRuns] = useState([]);
  const [name, setName] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    if (!firebaseConfigured) return;
    const invalidate = () => { generation.current++; };
    const unsubscribe = onAuthStateChanged(firebaseServices().auth, account => {
      generation.current++;
      setUser(account); setRuns([]); setMessage(''); setReady(true); setBusy(false);
    });
    return () => { invalidate(); unsubscribe(); };
  }, []);
  async function action(task) {
    const current = generation.current;
    setBusy(true); setMessage('');
    try { await task(() => generation.current === current); }
    catch (error) {
      if (generation.current === current) setMessage(error.code ? `Account save failed (${error.code}). Check your connection and try again.` : error.message);
    } finally { if (generation.current === current) setBusy(false); }
  }
  function list() {
    return action(async active => {
      const { db } = firebaseServices();
      const result = await getDocsFromServer(query(collection(db, 'users', user.uid, 'runs2048'), orderBy('updatedAt', 'desc'), limit(20)));
      if (active()) { setRuns(result.docs.map(item => ({ ...item.data(), id: item.id }))); setMessage(result.empty ? 'No saved runs yet.' : 'Showing your 20 most recent saves. Loading replaces the current board; save it first if you want to keep it.'); }
    });
  }
  return <section className="cloud-runs" aria-label="2048 account saves" onKeyDown={event => event.stopPropagation()}>
    <h2>Save your runs</h2>
    {!firebaseConfigured ? <p>Account saves are coming soon. Daily progress still saves in this browser.</p>
      : !ready ? <p>Checking sign-in…</p> : !user ? <>
        <p>Sign in to save runs and resume them on another device.</p>
        <button disabled={busy} onClick={() => action(() => { onPause(); return signInWithPopup(firebaseServices().auth, new GoogleAuthProvider()); })}>Sign in with Google</button>
      </> : <>
        <p>Signed in as {user.displayName || user.email}</p>
        <label>Save name <input maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="My 2048 run" /></label>
        <div className="cloud-runs-actions">
          <button disabled={busy || disabled} onClick={() => action(async active => {
            const payload = encodeRun(snapshot);
            const { db } = firebaseServices();
            const ref = doc(collection(db, 'users', user.uid, 'runs2048'));
            await setDoc(ref, { version: 1, name: name.trim() || `${snapshot.gameMode} · ${snapshot.score} points`, payload, updatedAt: serverTimestamp() });
            if (active()) setMessage('Run saved to your account. Save again after more moves to keep your latest progress.');
          })}>Save run</button>
          <button disabled={busy} onClick={list}>Show saved runs</button>
          <button disabled={busy} onClick={() => action(() => signOut(firebaseServices().auth))}>Sign out</button>
        </div>
        {runs.length > 0 && <ul>{runs.map(run => <li key={run.id}><span>{run.name}</span><button disabled={busy} onClick={() => action(async active => {
          const { db } = firebaseServices();
          const saved = await getDocFromServer(doc(db, 'users', user.uid, 'runs2048', run.id));
          if (!saved.exists()) throw new Error('This saved run no longer exists.');
          const data = validateRun(JSON.parse(saved.data().payload));
          if (active()) { onLoad(data); setMessage('Run loaded. The timer resumes on your next move.'); }
        })}>Load</button></li>)}</ul>}
      </>}
    <p role="status">{message}</p>
  </section>;
}
