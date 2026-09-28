# Firebase accounts and 2048 saves

Status: the 2048 account-save UI is currently disconnected at the owner's request.
The Firebase configuration, components, and rules are retained for future use;
existing cloud data has not been deleted.

The site stays on Netlify. Firebase Authentication handles Google sign-in and
Cloud Firestore stores private, manually saved 2048 snapshots. Each Save run
creates a new snapshot; Show saved runs displays the most recent 20. Progress
does not automatically sync after every move. Daily saves can only be loaded
on their original UTC date. Classic and Unlimited saves can be resumed later.
Local daily statistics remain browser-local; this feature does not sync them.

## Current configuration

The public Firebase web configuration for project `skeetergames` is now in
`.env.development` and `.env.production`, so Vite development and Netlify/local
production builds use this project. Authentication and Firestore still need to
be enabled and the rules published in the Firebase Console. Existing Netlify
environment variables override these files; remove or update any stale values.
Firebase Analytics is not initialized by this integration.

## First-time setup

1. Open https://console.firebase.google.com/ using the Google account that should
   own the site. Create a project. Google Analytics is optional for this setup.
2. In Project settings > General, register a Web app (`</>`). Firebase Hosting
   is unnecessary. Copy the Firebase configuration shown for the app.
3. Under Authentication > Get started > Sign-in method, enable Google, choose
   a support email, and save. Under Settings > Authorized domains add
   `skeetergames.org`, `www.skeetergames.org` if used, and `localhost` for testing.
   Add your exact Netlify domain if testing there too.
4. Create a Cloud Firestore database in **production mode**. Choose its location
   deliberately. In its Rules tab, publish the contents of `firestore.rules`.
   These rules restrict each user's saves to their own UID. Do not enable
   public read/write access. If the project already has data/rules, merge this
   collection rule instead of replacing unrelated rules.
5. Copy `.env.firebase.example` to `.env.local` and populate all four settings
   from the Web app configuration. No service account or private key is needed.
   Restart Vite after changing these values.
6. Add the same four environment variables to the Netlify site's build
   environment. Run `npm run build` and deploy. For manual uploads, build locally
   with `.env.local` populated and upload `dist`.

## Verify before release

- Sign in, make moves, undo, and save. Load on a second browser signed into the
  same account. Check mode, score, board, undo history, and elapsed time.
- Verify Classic, Unlimited, and today's Daily separately. The restored timer
  remains paused until the next valid move.
- Sign in with a different account; the first account's saves must not appear.
- In the Firebase Rules Playground, verify unauthenticated reads/writes and
  access to another UID are denied; an owner may read their own saved document.
- Test popup cancellation, blocked popups, network failure, and signing out.
  The UI only reports success after the Firestore write is acknowledged.
- Update your privacy notice to describe Firebase sign-in and saved game data.

Rules protect private ownership, not score authenticity. Console-modified game
data is not suitable for a trusted leaderboard. Review Firebase usage/billing
settings before making the feature publicly available.

References: https://firebase.google.com/docs/auth/web/google-signin and
https://firebase.google.com/docs/firestore/security/rules-conditions
