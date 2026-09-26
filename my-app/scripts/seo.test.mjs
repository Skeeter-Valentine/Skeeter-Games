import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, stat } from 'node:fs/promises';
import { pages } from '../src/seo/pages.js';

test('every public route has initial HTML, unique metadata, canonical and sitemap entry', async () => {
  const sitemap = await readFile('dist/sitemap.xml', 'utf8');
  const app = (await readFile('src/App.jsx', 'utf8')).replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const routes = [...app.matchAll(/<Route path="([^"]+)"/g)].map(match => match[1]).filter(path => path !== '*');
  assert.deepEqual(routes.sort(), Object.keys(pages).sort());
  assert.equal(new Set(Object.values(pages).map(page => page.title)).size, routes.length);
  assert.equal(new Set(Object.values(pages).map(page => page.description)).size, routes.length);
  for (const page of Object.values(pages)) {
    const html = await readFile(`dist${page.path === '/' ? '' : page.path}/index.html`, 'utf8');
    assert.ok(html.includes('name="description"'), page.path);
    assert.ok(html.includes(`rel="canonical" href="https://skeetergames.org${page.path}"`), page.path);
    assert.ok(html.includes('Explore puzzle games'), page.path);
    assert.ok(html.includes('<h1>'), page.path);
    assert.ok(!html.includes('noindex'), page.path);
    assert.ok(sitemap.includes(`<loc>https://skeetergames.org${page.path}</loc>`), page.path);
    if (page.path !== '/') {
      assert.ok(html.includes('How to play') && html.includes('A quick example'), page.path);
      assert.ok(page.rules.length >= 4);
    }
    for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)) await stat(`dist${match[1]}`);
  }
  assert.ok((await readFile('dist/robots.txt', 'utf8')).includes('Sitemap: https://skeetergames.org/sitemap.xml'));
  assert.ok((await readFile('dist/404.html', 'utf8')).includes('noindex,follow'));
  assert.ok((await readFile('dist/_redirects', 'utf8')).includes('/404.html   404'));
});
