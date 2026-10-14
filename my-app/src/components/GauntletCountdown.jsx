import { useEffect, useState } from 'react';
import { formatClock, gauntletDay, nextGauntletAt } from '../gauntlet/gauntlet.js';

// Live countdown to the next Skeeter Gauntlet (4am Mountain Time), e.g.
// "A new gauntlet opens in 6:42:10". Once it's open it says so instead.
export default function GauntletCountdown({ label = 'A new gauntlet opens in', className = '' }) {
  const [target] = useState(() => nextGauntletAt(gauntletDay()));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, Math.ceil((target - now) / 1000));
  return <span className={`gauntlet-countdown ${className}`.trim()} role="timer"
    title={new Date(target).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}>
    {left > 0 ? <>{label} <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatClock(left)}</strong></> : 'A new gauntlet is open. Refresh to play!'}
  </span>;
}
