# Sign-in and leaderboard setup

Everything here happens in the Firebase console, the provider sites, Netlify
and one terminal command. The code is already in place. Firebase project:
**skeetergames**. Do the steps in order; each ends with how to check it.

Handler URL used by every provider below (copy it exactly):

    https://skeetergames.firebaseapp.com/__/auth/handler

## 1. Firebase plan and Firestore

1. https://console.firebase.google.com → **skeetergames**.
2. Bottom-left shows the plan. Cloud Functions need **Blaze (pay as you go)**.
   If it says Spark, click *Upgrade*. Puzzle-site traffic sits inside the free
   allowance; set a budget alert of a few dollars under *Usage and billing*.
3. **Build → Firestore Database** must exist (production mode). If it asks you
   to create one, pick a US location and production mode.

Check: Firestore shows a *Data* tab.

## 2. Turn on the sign-in methods

**Build → Authentication → Sign-in method → Add new provider.**

| Method | What to do in Firebase | Extra setup outside Firebase |
|---|---|---|
| Anonymous | Enable (used for community puzzle stats) | none |
| Google | Enable, choose a support email | none |
| Email/Password | Enable the first switch only (not "Email link") | none |
| Microsoft | Enable, paste Application ID and secret | 2a |
| GitHub | Enable, paste Client ID and secret | 2b |
| Facebook | Enable, paste App ID and secret | 2c |
| Apple | Enable, fill in Services ID, Team ID, Key ID and key | 2d (needs a paid Apple Developer account) |

Google, Email and Anonymous work right away. Add the others when you have time;
the site only shows the buttons listed in `VITE_AUTH_PROVIDERS` (step 5).

### 2a. Microsoft (free)
1. https://portal.azure.com → *Microsoft Entra ID → App registrations → New registration*.
2. Name: Skeeter Games. Supported account types: *Accounts in any organizational
   directory and personal Microsoft accounts*. Redirect URI: *Web*, the handler URL.
3. Copy *Application (client) ID* into Firebase.
4. *Certificates & secrets → New client secret* (24 months). Copy the **Value**
   (not the ID) into Firebase. Put a calendar reminder to renew it before it expires.

### 2b. GitHub (free)
1. https://github.com/settings/developers → *OAuth Apps → New OAuth App*.
2. Homepage URL `https://skeetergames.org`, callback URL: the handler URL.
3. Copy the Client ID, *Generate a new client secret*, paste both into Firebase.

### 2c. Facebook (free, a few more forms)
1. https://developers.facebook.com/apps → *Create app* → use case
   *Authenticate and request data from users with Facebook Login*.
2. *App settings → Basic*: copy App ID and App secret into Firebase. Fill in
   Privacy Policy URL `https://skeetergames.org/privacy`, User data deletion
   (*Data deletion instructions URL*) `https://skeetergames.org/privacy#delete-account`,
   an app icon and category.
3. *Facebook Login → Settings → Valid OAuth Redirect URIs*: the handler URL.
4. Switch the app from *Development* to *Live* (top of the dashboard). Until
   then only you can sign in with Facebook.

### 2d. Apple ($99/year Apple Developer Program)
Follow Firebase's "Sign in with Apple" web guide: create an App ID with Sign in
with Apple, a *Services ID* (return URL: the handler URL, domain
`skeetergames.firebaseapp.com`), and a private key. Enter Services ID, Team ID,
Key ID and the key into Firebase. Skip Apple until you want to pay for it.

### Settings worth checking (Authentication → Settings)
- **Authorized domains**: `localhost`, `skeetergames.firebaseapp.com`,
  `skeetergames.org`, `www.skeetergames.org` and your `*.netlify.app` site name.
  Missing domains are the most common reason sign-in fails on the live site.
- **User account linking**: keep *Link accounts that use the same email*. If
  someone signs up with email and later tries Google with the same address,
  the site tells them to use the method they signed up with.
- **Templates** (Authentication → Templates): set the sender name to
  Skeeter Games for the verification and password-reset emails.

Check: run the site locally (`npm run dev`), click *Sign in* in the top-right
corner, sign in with Google, create an email account, use *Forgot password?*.

## 3. Find your owner ID

Open `/admin/archive` on the site and sign in with your Google account. It shows
your user ID. That ID
goes in `VITE_ADMIN_UIDS`.

## 4. Deploy the server code and rules (terminal, once per change)

From the `my-app` folder:

    npm install -g firebase-tools
    firebase login
    npm --prefix functions install
    firebase deploy --only functions,firestore:rules

`.firebaserc` already points at the skeetergames project. The deploy publishes
`recordPuzzleAttempt` (puzzle stats), `gauntletEvent` and `setNickname`
(leaderboard) and the Firestore rules (time to beat, leaderboard, nicknames).

Check: Firebase console → *Functions* lists three functions; *Firestore → Rules*
shows `gauntletBoard` and `nicknames`.

## 5. Netlify environment variables

Netlify → site → *Site configuration → Environment variables*. Vite reads these
at build time, so `.env.local` on your computer does **not** reach the live site.

| Key | Value |
|---|---|
| `VITE_PUZZLE_RESULTS_ENABLED` | `true` |
| `VITE_ADMIN_UIDS` | your ID from step 3 |
| `VITE_AUTH_PROVIDERS` | e.g. `google,email` now; later `google,apple,microsoft,facebook,github,email` |
| `VITE_GAUNTLET_BOARD_ENABLED` | `true` once step 4 is done |

The `VITE_FIREBASE_*` keys already come from `.env.production` in the repo; if
Netlify also has them, make sure they match. Then *Deploys → Trigger deploy →
Deploy site* (env changes only apply to a new build).

Put the same values in your local `.env.local` to test with `npm run dev`.

Check on skeetergames.org: sign in from the corner button, choose a nickname,
play a test gauntlet (`/gauntlet?test=1`) to the end and see yourself on the
*Test 1 leaderboard*.

## 6. Optional: show skeetergames.org on the sign-in screens

Google and the others show `skeetergames.firebaseapp.com` in their sign-in
pop-up. To show your own domain instead (and avoid sign-in problems in some
privacy-focused browsers):
1. `public/_redirects` already forwards `/__/auth/*` to Firebase.
2. Add `https://skeetergames.org/__/auth/handler` as an extra redirect/callback
   URL in each provider (Google: Google Cloud console → *APIs & Services →
   Credentials → Web client (auto created by Google Service)* → Authorized
   redirect URIs; Microsoft, GitHub, Facebook, Apple: where you added the
   handler URL above).
3. Set `VITE_FIREBASE_AUTH_DOMAIN=skeetergames.org` in Netlify and redeploy.

## Netlify "secrets scanning" build failures

Netlify fails a build when the value of one of its environment variables
appears in the repository or the built site. `VITE_ADMIN_UIDS` is a Firebase
user ID, not a password: it is in `firestore.rules` and in the site's
JavaScript by design. Tell Netlify to skip it by adding this environment
variable in Netlify (Site configuration > Environment variables):

    SECRETS_SCAN_OMIT_KEYS = VITE_ADMIN_UIDS

Add any other `VITE_` key Netlify complains about to the same comma-separated
list; every `VITE_` value is public in the built site anyway.

## Troubleshooting

- *Sign-in is not set up for this web address yet*: add the domain in step 2's
  Authorized domains.
- *That sign-in option is not available yet*: the provider is listed in
  `VITE_AUTH_PROVIDERS` but not enabled in Firebase.
- Nickname box says it can't save, or the Gauntlet says it couldn't reach the
  leaderboard: the functions from step 4 aren't deployed (or the plan isn't Blaze).
- Pop-up closes immediately: allow pop-ups for the site.
