// Ad settings shared by the app (through import.meta.env) and the prerender
// build script (through process.env). Everything is driven by environment
// variables so ads can be switched on, off or between networks in Netlify
// without a code change. See ADS-SETUP.md.

// Google's published certification authority ID for AdSense ads.txt lines.
export const ADSENSE_CERT_ID = 'f08c47fec0942fa0';
export const ADSENSE_SCRIPT = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
export const GROW_SCRIPT = 'https://faves.grow.me/main.js';
export const PLACEMENTS = ['side', 'belowGame', 'guide'];

const clean = value => String(value ?? '').trim();

export function adSettings(env = {}) {
  const provider = clean(env.VITE_ADS_PROVIDER || 'none').toLowerCase();
  const client = clean(env.VITE_ADSENSE_CLIENT);
  const validClient = /^ca-pub-\d{10,20}$/.test(client) ? client : '';
  const slot = value => (/^\d{6,20}$/.test(clean(value)) ? clean(value) : '');
  const grow = clean(env.VITE_GROW_SITE_ID);
  return {
    provider,
    client: validClient,
    // AdSense runs only when it is the chosen network and the publisher ID is valid.
    adsense: provider === 'adsense' && !!validClient,
    slots: { side: slot(env.VITE_ADSENSE_SLOT_SIDE), belowGame: slot(env.VITE_ADSENSE_SLOT_BELOW_GAME), guide: slot(env.VITE_ADSENSE_SLOT_GUIDE) },
    // Grow (Mediavine's script) can run alongside AdSense while Journey reviews the site.
    growSiteId: /^[A-Za-z0-9+/=_-]{8,200}$/.test(grow) ? grow : '',
    // Shows labelled placeholder boxes where ads will go, for checking layouts.
    preview: clean(env.VITE_ADS_PREVIEW) === 'true',
  };
}

// The ads.txt file Google checks before it serves ads. Written whenever a
// valid publisher ID is set, so it is live before the AdSense review.
export function adsTxt(settings) {
  if (!settings.client) return '';
  return `google.com, ${settings.client.replace(/^ca-/, '')}, DIRECT, ${ADSENSE_CERT_ID}\n`;
}

// Static <head> tags for the prerendered pages, so review crawlers find them
// without running JavaScript. Values are validated above, so no escaping is needed.
export function adHeadTags(settings) {
  let tags = '';
  if (settings.client) tags += `<meta name="google-adsense-account" content="${settings.client}" />`;
  if (settings.adsense) tags += `<script async src="${ADSENSE_SCRIPT}?client=${settings.client}" crossorigin="anonymous"></script>`;
  if (settings.growSiteId) tags += `<script defer src="${GROW_SCRIPT}" data-grow-faves-site-id="${settings.growSiteId}"></script>`;
  return tags;
}

// Adds the same scripts at runtime for pages that were not prerendered
// (and during development). Skips anything already in the page.
export function loadAdScripts(settings, doc = globalThis.document) {
  if (!doc?.head) return;
  if (settings.adsense && !doc.querySelector(`script[src^="${ADSENSE_SCRIPT}"]`)) {
    const script = doc.createElement('script');
    script.async = true;
    script.src = `${ADSENSE_SCRIPT}?client=${settings.client}`;
    script.crossOrigin = 'anonymous';
    doc.head.appendChild(script);
  }
  if (settings.growSiteId && !doc.querySelector('script[data-grow-faves-site-id]')) {
    const script = doc.createElement('script');
    script.defer = true;
    script.src = GROW_SCRIPT;
    script.setAttribute('data-grow-faves-site-id', settings.growSiteId);
    doc.head.appendChild(script);
  }
}
