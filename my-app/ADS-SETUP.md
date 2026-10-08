# Ads setup

Ads are controlled entirely by Netlify environment variables. With none set,
the site looks and behaves exactly as before (no ad spaces, no ad scripts).

## What is in the code

| Piece | Where |
| --- | --- |
| About and Privacy pages (`/about`, `/privacy`), prerendered for crawlers | `src/pages/info/InfoContent.jsx`, `src/seo/pages.js` |
| Footer on every page: All puzzles · About · Privacy policy · Privacy choices | `src/components/SiteFooter.jsx` |
| Contact email and "last updated" date for those pages | `src/siteInfo.js` |
| Page ads: side rails on wide screens, or one ad under the game on smaller screens | `src/ads/PageAds.jsx`, `src/ads/AdSlot.jsx` |
| An ad in the guide after "A quick example" | `src/seo/Seo.jsx` |
| Script loading, ads.txt and the AdSense verification tag | `src/ads/adsSetup.js`, `scripts/prerender.mjs` |

No ads appear on About, Privacy, the admin archive or the 404 page.

**Side rails** (left and right, they stay in view while scrolling):

- 160 × 600 on screens 1400px wide or more, 300 × 600 from 1760px. The screen also has to be at least 700px tall.
- At 1400px every game still leaves about 200px each side, so rails never cover a board. Checked on every page, including
  Skeedle Marathon's sticky header and keyboard. If you add a game wider than the homepage grid, raise the breakpoints in `PageAds.jsx`.
- Phones, tablets and smaller laptops have no room at the sides, so they get one ad under the game instead.
  The same happens on wide screens until the side ad unit ID is set.

Ad spaces reserve their size so the page does not jump, keep clear of game
controls and keyboards, refresh when the player changes page or archive date,
and collapse if no ad is available.

## Environment variables

| Variable | Example | What it does |
| --- | --- | --- |
| `VITE_ADSENSE_CLIENT` | `ca-pub-1234567890123456` | Your AdSense publisher ID. Adds `/ads.txt` and the `google-adsense-account` tag. Safe to set before approval. |
| `VITE_ADS_PROVIDER` | `adsense` | `none` (default), `adsense` (loads AdSense and fills the ad spaces) or `mediavine` (AdSense spaces off). |
| `VITE_ADSENSE_SLOT_SIDE` | `1122334455` | Ad unit ID for the two side rails (wide screens). |
| `VITE_ADSENSE_SLOT_BELOW_GAME` | `1234567890` | Ad unit ID for the space under each game (phones, tablets, small laptops). |
| `VITE_ADSENSE_SLOT_GUIDE` | `0987654321` | Ad unit ID for the space in the how-to-play guide. |
| `VITE_GROW_SITE_ID` | value of `data-grow-faves-site-id` | Loads Mediavine's Grow script (needed 30 days before Journey reviews the site). |
| `ADS_TXT_REDIRECT` | `https://adstxt.mediavine.com/sites/…/ads.txt` | Sends `/ads.txt` to a network's hosted file instead (Mediavine gives you this URL). |
| `VITE_ADS_PREVIEW` | `true` | Shows dashed "Ad space" boxes. Put it in `.env.local` only, to check layouts locally. |

After changing any variable in Netlify, trigger a new deploy (Deploys → Trigger deploy).
The build log ends with a line such as `Ads: AdSense on (ca-pub-…)` confirming what was used.

## Step 1 — AdSense (now)

1. Optional but recommended: put a contact email in `CONTACT_EMAIL` in `src/siteInfo.js`. Then deploy, and check that `/about` and `/privacy` look right.
2. Sign up at https://adsense.google.com with the site `skeetergames.org`.
3. Copy your publisher ID (Account → Account information, starts with `ca-pub-`).
   In Netlify, set `VITE_ADSENSE_CLIENT` to it and `VITE_ADS_PROVIDER=adsense`, then redeploy.
4. Check that https://skeetergames.org/ads.txt shows `google.com, pub-…, DIRECT, f08c47fec0942fa0`.
5. In AdSense → Sites, verify the site (the meta tag or ads.txt option both work) and request review. Reviews usually take from a few days to a few weeks.
6. Leave **Auto ads off**. The site places its own ads in the reserved spaces.
7. In AdSense → Privacy & messaging, create and publish:
   - a **European regulations** message (Google's certified consent banner, required for EEA/UK/Swiss visitors), and
   - a **US state regulations** message.
   The footer's "Privacy choices" link reopens these, so visitors can change their answer.
8. After approval: Ads → By ad unit → Display ads, create three units and copy each `data-ad-slot` number:
   - "Side rails" (**vertical**) → `VITE_ADSENSE_SLOT_SIDE`. The site fills it at 160 × 600 or 300 × 600 depending on screen width.
   - "Below game" (**responsive**) → `VITE_ADSENSE_SLOT_BELOW_GAME`
   - "Guide" (**responsive**) → `VITE_ADSENSE_SLOT_GUIDE`

   Then redeploy. Separate units let AdSense report how each position earns.

## Step 2 — Journey by Mediavine (site eligible from about December 22, 2026)

1. By about **November 22**: sign up for Grow and set `VITE_GROW_SITE_ID`. Grow has to run 30 days before Journey reviews the site. AdSense can keep running alongside it.
2. Around **December 22** (4 months after launch): apply to Journey.
3. When approved, Mediavine will give you an ads.txt URL and their ad script:
   - set `ADS_TXT_REDIRECT` to the ads.txt URL,
   - set `VITE_ADS_PROVIDER=mediavine` (this switches the AdSense spaces off),
   - add Mediavine's script (a small code change, not handled by these variables yet),
   - add Mediavine to the Advertising section of the privacy policy and update `PRIVACY_UPDATED`.

## Step 3 — Raptive (from about February 22, 2027)

Worth applying once the site is past 100,000 pageviews a month. Below that,
Raptive also requires long-form written content on most pages.

## Notes

- Google Analytics is loaded once in `index.html`. Ske4dle used to load it a second time, which double-counted its page views; that has been removed.
- The privacy policy is a starting point written from what the code does, not legal advice. Update it whenever you add a new service that collects data.
