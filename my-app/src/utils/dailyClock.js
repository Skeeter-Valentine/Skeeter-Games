export const dailyDate = (now = new Date()) => now.toISOString().slice(0, 10);

export function watchDailyDate(onChange, {
  now = () => new Date(), schedule = setTimeout, cancel = clearTimeout,
  windowTarget = window, documentTarget = document,
} = {}) {
  let timer;
  const refresh = () => {
    cancel(timer);
    const current = now();
    onChange(dailyDate(current));
    timer = schedule(refresh, 86400000 - (current.getTime() % 86400000));
  };
  refresh();
  windowTarget.addEventListener('focus', refresh);
  documentTarget.addEventListener('visibilitychange', refresh);
  return () => {
    cancel(timer);
    windowTarget.removeEventListener('focus', refresh);
    documentTarget.removeEventListener('visibilitychange', refresh);
  };
}
