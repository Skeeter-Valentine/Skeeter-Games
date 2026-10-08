import assert from 'node:assert/strict';
import test from 'node:test';
import { adSettings, adsTxt, adHeadTags, loadAdScripts, ADSENSE_SCRIPT, GROW_SCRIPT } from './adsSetup.js';

const client = 'ca-pub-1234567890123456';

test('ads stay off unless AdSense is chosen with a valid publisher ID', () => {
  assert.equal(adSettings({}).adsense, false);
  assert.equal(adSettings({ VITE_ADSENSE_CLIENT: client }).adsense, false);
  assert.equal(adSettings({ VITE_ADS_PROVIDER: 'adsense', VITE_ADSENSE_CLIENT: 'pub-123' }).adsense, false);
  const on = adSettings({ VITE_ADS_PROVIDER: ' AdSense ', VITE_ADSENSE_CLIENT: client, VITE_ADSENSE_SLOT_BELOW_GAME: '1234567890', VITE_ADSENSE_SLOT_GUIDE: 'abc', VITE_ADSENSE_SLOT_SIDE: '3333333333' });
  assert.equal(on.adsense, true);
  assert.deepEqual(on.slots, { side: '3333333333', belowGame: '1234567890', guide: '' });
});

test('ads.txt is written as soon as the publisher ID is known', () => {
  assert.equal(adsTxt(adSettings({})), '');
  assert.equal(adsTxt(adSettings({ VITE_ADSENSE_CLIENT: client })), 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
});

test('head tags: verification meta always, scripts only when switched on, nothing unsafe', () => {
  assert.equal(adHeadTags(adSettings({})), '');
  const reviewOnly = adHeadTags(adSettings({ VITE_ADSENSE_CLIENT: client }));
  assert.ok(reviewOnly.includes('google-adsense-account') && !reviewOnly.includes('<script'));
  const all = adHeadTags(adSettings({ VITE_ADS_PROVIDER: 'adsense', VITE_ADSENSE_CLIENT: client, VITE_GROW_SITE_ID: 'U2l0ZToxMjM0NQ==' }));
  assert.ok(all.includes(`${ADSENSE_SCRIPT}?client=${client}`) && all.includes(GROW_SCRIPT));
  assert.equal(adSettings({ VITE_GROW_SITE_ID: '"><script>alert(1)</script>' }).growSiteId, '');
});

test('runtime loader adds each script once', () => {
  const added = [];
  const doc = {
    head: { appendChild: node => added.push(node) },
    createElement: () => ({ setAttribute(name, value) { this[name] = value; } }),
    querySelector: selector => added.find(node => selector.includes('grow') ? node['data-grow-faves-site-id'] : node.src?.startsWith(ADSENSE_SCRIPT)) || null,
  };
  const settings = adSettings({ VITE_ADS_PROVIDER: 'adsense', VITE_ADSENSE_CLIENT: client, VITE_GROW_SITE_ID: 'U2l0ZToxMjM0NQ==' });
  loadAdScripts(settings, doc);
  loadAdScripts(settings, doc);
  assert.equal(added.length, 2);
  loadAdScripts(adSettings({}), { head: { appendChild: () => assert.fail('should not load') }, querySelector: () => null });
});
