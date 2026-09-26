import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer, loadEnv } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { pages } from '../src/seo/pages.js';

const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
const origin = env.VITE_SITE_URL;
if (!origin || !/^https:\/\/[^/]+\/?$/.test(origin)) throw new Error('Set VITE_SITE_URL to your public HTTPS origin before building.');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const template = await readFile('dist/index.html', 'utf8');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { Guide } = await server.ssrLoadModule('/src/seo/Seo.jsx');
  for (const page of Object.values(pages)) {
    const markup = renderToStaticMarkup(React.createElement(Guide, { page }));
    const verification = env.GOOGLE_SITE_VERIFICATION ? `<meta name="google-site-verification" content="${escape(env.GOOGLE_SITE_VERIFICATION)}" />` : '';
    const head = `<meta name="description" content="${escape(page.description)}" /><link rel="canonical" href="${escape(new URL(page.path, origin).href)}" />${verification}`;
    const shell = page.path === '/' ? '' : `<header class="game-prerender-shell"><a href="/">Skeeter Games</a><h1>${escape(page.name)}</h1><p>Loading the interactive puzzle…</p><noscript>Enable JavaScript to play. You can read the rules and example below.</noscript></header>`;
    const html = template.replace(/<title>.*?<\/title>/s, `<title>${escape(page.title)}</title>`).replace('</head>', `${head}</head>`).replace('<div id="root"></div>', `<div id="root">${shell}${markup}</div>`);
    const directory = `dist${page.path === '/' ? '' : page.path}`;
    await mkdir(directory, { recursive: true });
    await writeFile(`${directory}/index.html`, html);
  }
  const urls = Object.values(pages).map(page => `<url><loc>${escape(new URL(page.path, origin).href)}</loc></url>`).join('\n');
  await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
  await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap.xml', origin).href}\n`);
  await writeFile('dist/404.html', template.replace('</head>', '<meta name="robots" content="noindex,follow" /></head>').replace('<title>Skeeter Games</title>', '<title>Page Not Found | Skeeter Games</title>'));
  console.log(`Prerendered ${Object.keys(pages).length} pages, sitemap, robots.txt, and 404 page.`);
} finally { await server.close(); }
