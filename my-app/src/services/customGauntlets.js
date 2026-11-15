import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseConfigured, firebaseServices } from './firebase.js';
import { setCustomGauntlets } from '../gauntlet/gauntlet.js';

// Custom gauntlets (customGauntlets/{day}: { day, title, games }), made by the
// owner at /admin/gauntlets. They're few, so the whole list is loaded once
// per visit and handed to gauntlet.js, which uses it for those days' lineups
// and names.
let loading = null;
export function loadCustomGauntlets({ refresh = false } = {}) {
  if (!firebaseConfigured) return Promise.resolve([]);
  if (!loading || refresh) {
    loading = getDocs(collection(firebaseServices().db, 'customGauntlets')).then(snapshot => {
      const list = snapshot.docs.map(entry => ({ ...entry.data(), day: entry.id }));
      setCustomGauntlets(list);
      return list;
    });
    // A failed load is tried again next time.
    loading.catch(() => { loading = null; });
  }
  return loading;
}

// 'loading' | 'ready' | 'error', a retry function, and a counter that changes
// whenever the list is reloaded (so pages can re-read lineups).
export function useCustomGauntlets() {
  const [state, setState] = useState(firebaseConfigured ? 'loading' : 'ready');
  const [version, setVersion] = useState(0);
  const load = useCallback(refresh => {
    let active = true;
    setState(current => (current === 'ready' && refresh ? 'ready' : 'loading'));
    loadCustomGauntlets({ refresh }).then(() => { if (active) { setState('ready'); setVersion(v => v + 1); } },
      () => { if (active) setState('error'); });
    return () => { active = false; };
  }, []);
  useEffect(() => load(false), [load]);
  return { state, version, reload: () => load(true) };
}

// ----- Owner only (the Firestore rules refuse everyone else) -----
export const saveCustomGauntlet = (day, { title, games }) => setDoc(doc(firebaseServices().db, 'customGauntlets', day),
  { day, title: title.trim().slice(0, 40), games: [...games], updatedAt: serverTimestamp() });
export const deleteCustomGauntlet = day => deleteDoc(doc(firebaseServices().db, 'customGauntlets', day));
