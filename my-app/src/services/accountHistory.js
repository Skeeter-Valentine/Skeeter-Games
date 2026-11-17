import { useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { accountsEnabled } from './gauntletBoard.js';
import { firebaseServices } from './firebase.js';

// A signed-in player's results saved on their account (players/{uid}), so
// streaks and stats follow them between devices:
//   { gauntlet: { [day]: { total, solved } }, daily: { [game]: { [date]: { won, seconds } } } }
// Read once per visit; this device's own results are merged in by each page.
const cache = new Map();
export function loadAccountHistory(uid) {
  if (!cache.has(uid)) {
    const loading = getDoc(doc(firebaseServices().db, 'players', uid))
      .then(snapshot => {
        const data = snapshot.exists() ? snapshot.data() : {};
        return { gauntlet: data.gauntletHistory ?? {}, daily: data.dailyHistory ?? {} };
      });
    loading.catch(() => cache.delete(uid));
    cache.set(uid, loading);
  }
  return cache.get(uid);
}

// The account history for whoever is signed in (null when signed out,
// anonymous, or not loaded yet).
export function useAccountHistory() {
  const [history, setHistory] = useState(null);
  useEffect(() => {
    if (!accountsEnabled) return undefined;
    let active = true;
    const stop = onIdTokenChanged(firebaseServices().auth, user => {
      if (!user || user.isAnonymous) { setHistory(null); return; }
      loadAccountHistory(user.uid).then(value => { if (active) setHistory(value); }).catch(() => {});
    });
    return () => { active = false; stop(); };
  }, []);
  return history;
}
