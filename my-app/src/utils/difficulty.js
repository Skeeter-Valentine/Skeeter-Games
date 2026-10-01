// Community difficulty for archive puzzles, from the aggregate counters the
// recordPuzzleAttempt function keeps in Firestore (puzzleRates documents).

// Must match TIME_BUCKETS in functions/attempts.js (checked by a test).
export const TIME_BUCKETS = [30, 60, 120, 180, 300, 450, 600, 900, 1200, 1800, 2700, 3600];

const count = value => Number.isFinite(value) && value > 0 ? value : 0;

// Daily and archive plays of the same puzzle are kept apart for streaks, but
// for difficulty they are the same puzzle, so their counters are added up.
export function combineRates(docs) {
  const total = { starts: 0, wins: 0, losses: 0, timedWins: 0, winSeconds: 0, timeBuckets: {} };
  for (const doc of docs) {
    if (!doc) continue;
    for (const key of ['starts', 'wins', 'losses', 'timedWins', 'winSeconds']) total[key] += count(doc[key]);
    for (const [bucket, n] of Object.entries(doc.timeBuckets || {})) total.timeBuckets[bucket] = (total.timeBuckets[bucket] || 0) + count(n);
  }
  return total;
}

// Estimate the median solve time from bucket counts, interpolating within
// the bucket that holds the middle solve. The last bucket is open-ended, so
// it is treated as running to double its lower edge.
export function medianFromBuckets(buckets) {
  const counts = TIME_BUCKETS.map((_, i) => count(buckets?.[`b${i}`])).concat(count(buckets?.[`b${TIME_BUCKETS.length}`]));
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const half = total / 2;
  let seen = 0;
  for (let i = 0; i < counts.length; i++) {
    if (seen + counts[i] >= half && counts[i]) {
      const low = i === 0 ? 0 : TIME_BUCKETS[i - 1];
      const high = i < TIME_BUCKETS.length ? TIME_BUCKETS[i] : TIME_BUCKETS.at(-1) * 2;
      return Math.round(low + (high - low) * ((half - seen) / counts[i]));
    }
    seen += counts[i];
  }
  return null;
}

export function puzzleSummary(rates) {
  const r = combineRates([rates]);
  return {
    starts: r.starts, wins: r.wins, losses: r.losses, unfinished: Math.max(0, r.starts - r.wins - r.losses),
    completion: r.starts ? r.wins / r.starts : null,
    averageSeconds: r.timedWins ? Math.round(r.winSeconds / r.timedWins) : null,
    medianSeconds: medianFromBuckets(r.timeBuckets),
  };
}

const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
function zScorer(values) {
  if (values.length < 2) return () => 0;
  const m = mean(values);
  const sd = Math.sqrt(mean(values.map(v => (v - m) ** 2)));
  return value => sd > 0 ? (value - m) / sd : 0;
}

// How many players it takes before community results outweigh the chili
// rating. With 8 players, results and the chili rating count equally.
export const PRIOR_PLAYERS = 8;

// rows: [{ date, chili (1-3), rates: combined counters or null }]
// Returns rows with summary, score and rank (1 = hardest). The score blends,
// within one game: how often players fail to finish, and how slow the median
// solve is compared with that game's other puzzles. Both are z-scores, so
// puzzles are compared only with puzzles of the same game. Puzzles with few
// players lean on the chili rating until enough results arrive.
export function rankPuzzles(rows) {
  const enriched = rows.map(row => ({ ...row, summary: puzzleSummary(row.rates) }));
  const played = enriched.filter(row => row.summary.starts > 0);
  const failZ = zScorer(played.map(row => 1 - row.summary.completion));
  const timed = played.filter(row => row.summary.medianSeconds);
  const timeZ = zScorer(timed.map(row => Math.log(row.summary.medianSeconds)));
  const scored = enriched.map(row => {
    const { starts, completion, medianSeconds } = row.summary;
    const prior = (row.chili ?? 2) - 2;
    if (!starts) return { ...row, score: prior, confidence: 'none' };
    const parts = [failZ(1 - completion)];
    if (medianSeconds && timed.length >= 2) parts.push(timeZ(Math.log(medianSeconds)));
    const community = mean(parts);
    const weight = starts / (starts + PRIOR_PLAYERS);
    return { ...row, score: weight * community + (1 - weight) * prior, confidence: starts >= 20 ? 'high' : starts >= 5 ? 'medium' : 'low' };
  });
  const order = [...scored].sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
  return scored.map(row => ({ ...row, rank: order.indexOf(row) + 1 }));
}
