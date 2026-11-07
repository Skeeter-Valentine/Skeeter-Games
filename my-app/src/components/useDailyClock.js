import { useEffect, useState } from 'react';
import { clockRunning } from '../utils/clockRunning.js';

// Whether this tab is showing. Puzzle clocks pause while it's hidden.
export function usePageVisible() {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

export function useClockRunning(options) {
  const visible = usePageVisible();
  return clockRunning({ ...options, visible });
}
