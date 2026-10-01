# Daily archive rollout

Implemented in this batch:
- Map defaults to a deterministic UTC daily puzzle, varying between 12, 24, and 35 regions with the shared spice schedule. Practice stays available.
- Map and Akari have a date picker and `?date=YYYY-MM-DD` archive links. Other games deliberately ignore that parameter until their progress has been migrated.
- Puzzle snapshots are saved locally, independently from progress. Map restores undo/redo history; Akari restores bulbs, marks, and elapsed time. Archive progress, clocks, and first results are separate from live daily records.
- Historical puzzles are generated with the current edition, starting August 20, 2026. These are recreated puzzles, not verified copies of past releases. Local snapshots survive updates in that browser but are not a server-side puzzle repository.
- The shared daily-results component queues starts and first outcomes for each game/date/mode. Timed games count a start when their timer advances; untimed games rely on their started signal. Practice is excluded.

## Community reporting deployment (not enabled or deployed by this change)
1. Use the existing Firebase project, with Functions billing available, and enable Anonymous sign-in in Firebase Authentication. Existing signed-in users keep their identity.
2. Install the function dependencies with `npm --prefix functions install`.
3. Using Firebase CLI authenticated to that project, deploy with `firebase deploy --project YOUR_PROJECT_ID --only functions:recordPuzzleAttempt,firestore:rules`.
4. Set `VITE_PUZZLE_RESULTS_ENABLED=true` alongside the existing Firebase client environment variables in the website build environment; rebuild and deploy the site.
5. Verify a started attempt, its completion, and a reload from two browsers. Inspect `puzzleRates` to confirm counters do not duplicate. This live integration check has not been run.

The callable function uses an authenticated UID and a Firestore transaction to count one attempt and one immutable first outcome per game/date/mode. Clients cannot directly write aggregate counters. Daily and archive aggregates remain separate. Win rate is wins / starts; abandoned attempts remain unfinished. Reports are client-reported, not cheat-proof. Anonymous players are browser identities, not guaranteed unique people; clearing browser data or changing accounts can create another identity. Sign in across devices for a consistent UID.

Failed sends retry while the puzzle is mounted and on reconnection. The saved payload is retried when that puzzle is opened again; this is not a global background outbox. No retrospective community data can be reconstructed for players who never reported a result.

## Remaining archive work
- Migrate each remaining game's progress and any legacy statistics to archive-safe storage, then add it to `ARCHIVE_GAMES`.
- Save the full generated puzzle/configuration for each game, rather than relying only on a seed or the current word list.
- Add a shared, durable puzzle catalog before promising the original historical puzzle across all browsers and future generator editions.
- Validate Firebase deployment and reporting before enabling its environment flag. This batch validates pure counter transitions, not a live Firebase transaction.

Focused checks: Map determinism and valid solutions, progress restoration, archive dates/snapshot isolation, backend validation/idempotency, route rendering, and the production build.
