// src/utils/gauntletUtils.js

// Simple string hash to create a numeric seed from a date string like "2026-09-18"
function getDailySeed(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Seeded pseudo-random number generator (Mulberry32)
function seededRandom(seed) {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Fisher-Yates shuffle using our seeded random generator
export function getDailyGauntletGames(allGames) {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  let seed = getDailySeed(today);
  
  // Filter out excluded games or games without a component first
  const eligibleGames = allGames.filter(game => game.component && !game.excludeFromGauntlet);

  // Clone filtered array to avoid mutating original list
  const shuffled = [...eligibleGames];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const rnd = seed / 233280;
    const j = Math.floor(rnd * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  // Return the first 5 games of the day (or fewer if total eligible is less than 5)
  return shuffled.slice(0, 5);
}