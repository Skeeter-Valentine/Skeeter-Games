# SEO setup and launch checks

`npm run build` produces 14 separate HTML pages in `dist`, each with its own title, description, canonical URL, readable guide, and links. React replaces the initial content with the interactive page and the same guide. Game state is not generated or recorded during the build. `src/seo/pages.js` is the metadata and example registry; the guides reuse the instruction modal's rules.

## Deployment

Deploy the complete `dist` directory with the normal hosting workflow. The public origin is configured as `https://skeetergames.org` in `.env.production`; update it and `.env.development` if the preferred domain changes. Configure the host to redirect alternative hostnames to this origin.

The `_redirects` file uses Netlify-style rules. Existing generated files must take precedence over its final 404 rule. For other hosts, serve `/stitches` from `/stitches/index.html` (and similarly for the other routes), and return `404.html` with HTTP status 404 for unknown paths. Do not restore a blanket index.html / 200 fallback: that would hide the route-specific pages and produce soft 404s.

## Google Search Console (requires the owner's account)

1. Sign in at https://search.google.com/search-console and add the `skeetergames.org` Domain property.
2. Add the DNS TXT record supplied by Google at your domain's DNS provider, then select Verify. Do not invent a verification value.
3. Alternatively, add the URL-prefix property `https://skeetergames.org/`. If using HTML meta-tag verification, set the build environment variable `GOOGLE_SITE_VERIFICATION` to the exact content value from Google's tag. Rebuild and deploy before verifying. This is a public verification token, not a password.
4. After deployment, submit `https://skeetergames.org/sitemap.xml` in Sitemaps.
5. Inspect the homepage and representative game URLs using URL Inspection. Use the live test to confirm Google sees the title, rules, and canonical URL, then request indexing.
6. Review indexing, search queries, impressions, clicks, and Core Web Vitals as data accumulates. Analytics is separate from Search Console; the existing Analytics tag is kept once in index.html.

Search Console verification and submission have not been completed: the browser session was signed out. These require account access and a deployed build.

## Performance

Game cards use 640px WebP derivatives and the header logos use small derivatives. Originals are preserved. Regenerate with `python scripts/optimize-images.py` in a Python environment with Pillow. Images after the first row load lazily and all cards reserve their dimensions. Check PageSpeed Insights on the deployed home and game pages; compare mobile LCP, INP, and CLS before and after deployment. Reduced asset sizes are verified locally; live performance scores are not yet measured.

## Local validation

Run `npm run build`, then `node --test scripts/seo.test.mjs src/components/gameTools.test.mjs`. The SEO check verifies every route has static content, unique metadata, canonical links, sitemap coverage, valid bundled asset paths, and a noindex 404 page.
