const memory = new Map();
export const statsKey = gameId => `skeeter:daily-results:v1:${gameId}`;
export const clockKey = (gameId, date) => `skeeter:daily-clock:v1:${gameId}:${date}`;

export function readLocal(key, fallback) {
  try {
    const raw = globalThis.localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw);
  } catch { /* Corrupt/blocked storage must not interrupt a game. */ }
  return memory.get(key) ?? fallback;
}

export function writeLocal(key, value) {
  memory.set(key, value);
  try { globalThis.localStorage.setItem(key, JSON.stringify(value)); } catch { /* Session-only fallback. */ }
}

const dayNumber = date => Date.parse(`${date}T00:00:00Z`) / 86400000;
const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(dayNumber(date))
  && new Date(dayNumber(date) * 86400000).toISOString().slice(0, 10) === date;
export const validSeconds = seconds => typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0;

export function readDailyStats(gameId) {
  const saved = readLocal(statsKey(gameId), {});
  const results = {};
  if (saved?.results && typeof saved.results === 'object') {
    for (const [date, result] of Object.entries(saved.results)) {
      if (validDate(date) && result && typeof result.won === 'boolean') {
        results[date] = { ...result, seconds: validSeconds(result.seconds) ? Math.floor(result.seconds) : null };
      }
    }
  }
  return { version: 1, results };
}

export function recordDailyResult(gameId, date, won, seconds) {
  if (!validDate(date)) throw new Error('Daily results require a valid puzzle date.');
  const stats = readDailyStats(gameId);
  // First result is final, including losses. Reloading, resetting, and replaying
  // a completed daily cannot improve its time or add another win.
  if (!stats.results[date]) {
    stats.results[date] = { won: Boolean(won), seconds: validSeconds(seconds) ? Math.floor(seconds) : null };
    writeLocal(statsKey(gameId), stats);
  }
  return stats;
}

export function summarizeDailyStats(stats, today) {
  const entries = Object.entries(stats.results).filter(([date]) => date <= today).sort(([a], [b]) => a.localeCompare(b));
  let wins = 0, streak = 0, maxStreak = 0, previousDay = null;
  const times = [];
  for (const [date, result] of entries) {
    const day = dayNumber(date);
    if (result.won) {
      wins++;
      streak = previousDay === day - 1 ? streak + 1 : 1;
      maxStreak = Math.max(maxStreak, streak);
      if (validSeconds(result.seconds)) times.push(result.seconds);
    } else streak = 0;
    previousDay = day;
  }
  if (previousDay === null || dayNumber(today) - previousDay > 1) streak = 0;
  return {
    played: entries.length, wins, winRate: entries.length ? Math.round(wins / entries.length * 100) : 0,
    currentStreak: streak, maxStreak,
    bestTime: times.length ? Math.min(...times) : null,
    averageTime: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
  };
}

export function formatDuration(seconds) {
  if (!validSeconds(seconds)) return 'Not recorded';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total % 3600 / 60);
  return `${hours ? `${hours}:${String(minutes).padStart(2, '0')}` : minutes}:${String(total % 60).padStart(2, '0')}`;
}
