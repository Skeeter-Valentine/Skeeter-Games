import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { dailyDate, watchDailyDate } from '../utils/dailyClock.js';

const DailyContext = createContext(null);

export function useDailyDate() {
  const session = useContext(DailyContext);
  // A mounted session keeps its date until the whole daily game remounts.
  const [fallbackDate] = useState(dailyDate);
  return session?.date ?? fallbackDate;
}

export function useDailyMode(daily) {
  const session = useContext(DailyContext);
  const setDaily = session?.setDaily;
  useEffect(() => { setDaily?.(!!daily); }, [daily, setDaily]);
}

export default function DailyBoundary({ children }) {
  const [date, setDate] = useState(dailyDate);
  const [daily, setDaily] = useState(true);
  useEffect(() => {
    if (daily) return watchDailyDate(setDate);
  }, [daily]);
  const value = useMemo(() => ({ date, setDaily }), [date]);
  return <DailyContext.Provider key={date} value={value}>{children}</DailyContext.Provider>;
}
