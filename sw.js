// Caches the app so it opens without signal (e.g. on a train in Japan).
// Bump VERSION whenever you deploy changes; users get the new version on the next launch.
const VERSION = 'trips-v28-map5';
const SHELL = ['./', 'index.html', 'style.css?v=28-map5', 'locale.js?v=28-map5', 'seed.js?v=28-map5', 'seed-research.js?v=28-map5', 'tz.js?v=28-map5', 'store.js?v=28-map5',
  'fashion-catalog.js?v=28-map5', 'places.js?v=28-map5', 'reco.js?v=28-map5', 'fx.js?v=28-map5', 'receipt.js?v=28-map5', 'locate.js?v=28-map5', 'splitter.js?v=28-map5', 'firebase-config.js?v=28-map5', 'sync.js?v=28-map5', 'ai.js?v=28-map5', 'plan.js?v=28-map5', 'discovery.js?v=28-map5', 'app.js?v=28-map5', 'slowpoke.js?v=28-map5', 'manifest.webmanifest'];
const OPTIONAL = ['icons/slowpoke.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(async c => { await Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })))); await Promise.allSettled(OPTIONAL.map(x => c.add(x))); }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('trips-v') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Map tiles: keep what you've already viewed, so areas you looked at earlier still show offline.
  if (url.hostname === 'tile.openstreetmap.org') {
    e.respondWith(caches.open('tiles-v2').then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  // Pages (index.html): network first so a new deploy shows on the very next load; cache only when offline.
  if (url.origin === location.origin && (e.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) {
    e.respondWith(caches.open(VERSION).then(async c => {
      try { const res = await fetch(e.request, { cache: 'no-cache' }); if (res.ok) c.put(e.request, res.clone()); return res; }
      catch { return (await c.match(e.request, { ignoreSearch: true })) || (await c.match('index.html')) || (await c.match('./')); }
    }));
    return;
  }
  // App files: serve from cache, refresh in the background.
  if (url.origin === location.origin || url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(e.request, { ignoreSearch: url.origin === location.origin && url.pathname.endsWith('/') });
      const net = fetch(e.request).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
