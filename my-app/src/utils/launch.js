// Games that are built but not launched yet. A hidden game has no homepage
// card, no page in the sitemap or "Explore more" links, and no route on the
// live site (it still opens at its path under `npm run dev`, for testing).
// To launch one, set it to true and push.
export const LAUNCHED = {
  slitherlink: true,
  // Skeetmate: switch on once the puzzle bank is filled from Lichess
  // (scripts/build-chess-puzzles.mjs).
  chess: false,
};
export const isLaunched = id => LAUNCHED[id] !== false;
