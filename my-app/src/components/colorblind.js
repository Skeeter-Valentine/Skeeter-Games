import { useEffect, useState } from 'react';

// Word games whose feedback colors switch in colorblind mode.
export const COLORBLIND_GAMES = ['skeedlemath', 'skeedle-marathon', 'quordle', 'parshle', 'word500'];
const KEY = 'skeeter:colorblind';
const listeners = new Set();

function readSetting() {
  try { return globalThis.localStorage?.getItem(KEY) === 'on'; } catch { return false; }
}
function apply(on) {
  if (typeof document !== 'undefined') document.documentElement.dataset.colorblind = on ? 'on' : 'off';
}

// Apply the saved choice as soon as the app loads, before the first paint,
// so colorblind players never see a flash of green and yellow.
apply(readSetting());

export function setColorblind(on) {
  try { globalThis.localStorage?.setItem(KEY, on ? 'on' : 'off'); } catch { /* still applies for this visit */ }
  apply(on);
  listeners.forEach(listener => listener(on));
}

// One shared setting for every word game, kept in sync across components.
export function useColorblind() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(readSetting());
    listeners.add(setOn);
    return () => listeners.delete(setOn);
  }, []);
  return [on, setColorblind];
}
