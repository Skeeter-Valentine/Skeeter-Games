import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { dailyDate, watchDailyDate } from '../utils/dailyClock.js';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ARCHIVE_GAMES, gameStorage, validArchiveDate } from '../utils/archive.js';

const DailyContext = createContext(null);
export const useArchive = () => useContext(DailyContext);
export function useGameStorage() {
  const archive = !!useArchive()?.archive;
  return useMemo(() => gameStorage(archive), [archive]);
}

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
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const archiveEnabled = ARCHIVE_GAMES.includes(pathname.slice(1));
  const [revision, setRevision] = useState(0);
  const [date, setDate] = useState(dailyDate);
  const [today, setToday] = useState(dailyDate);
  const [daily, setDaily] = useState(true);
  const requested = params.get('date');
  const archive = archiveEnabled && validArchiveDate(requested, today);
  const selectedDate = archive ? requested : date;
  useEffect(() => watchDailyDate(setToday), []);
  useEffect(() => {
    if (daily && !archive) return watchDailyDate(setDate);
  }, [daily, archive]);
  const value = useMemo(() => ({ date: selectedDate, today, archive, archiveEnabled, setDaily,
    selectDate: next => {
      setDate(today); setDaily(true); setRevision(value => value + 1);
      setParams(previous => {
      const updated = new URLSearchParams(previous);
      if (next === today) updated.delete('date'); else updated.set('date', next);
      return updated;
      });
    },
  }), [selectedDate, today, archive, archiveEnabled, setParams]);
  return <DailyContext.Provider key={`${pathname}:${selectedDate}:${archive}:${revision}`} value={value}>{children}</DailyContext.Provider>;
}
