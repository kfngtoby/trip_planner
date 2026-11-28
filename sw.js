// Caches the app so it opens without signal (e.g. on a train in Japan).
// Deploy: bump V here AND the ?v= ids in index.html (same value), e.g. with: sed -i 's/58-ios-pwa-speed/NEW/g' sw.js index.html
const V = '58-ios-pwa-speed';
const VERSION = 'trips-v' + V;
const q = f => f + '?v=' + V;
const SHELL = ['./', 'index.html', 'manifest.webmanifest', q('style.css'), q('ios.css'),
  ...['locale', 'seed', 'seed-research', 'store', 'fashion-catalog', 'places', 'reco', 'fx', 'receipt', 'locate', 'splitter',
    'firebase-config', 'sync', 'ai', 'discovery', 'csv', 'xlsx', 'map-enhancements', 'app', 'slowpoke'].map(n => q(n + '.js'))];
const OPTIONAL = ['slowpoke.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
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
      try {
        const res = await fetch(e.request);
        if (res.ok) { c.put(e.request, res.clone()); c.keys().then(ks => ks.length > 600 && Promise.all(ks.slice(0, ks.length - 500).map(k => c.delete(k)))); }
        return res;
      } catch { return Response.error(); }
    }));
    return;
  }
  // Pages (index.html): network first so a new deploy shows on the very next load; cache only when offline.
  if (url.origin === location.origin && (e.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) {
    e.respondWith(caches.open(VERSION).then(async c => {
      try { const res = await fetch(e.request, { cache: 'no-cache' }); if (res.ok) c.put(e.request, res.clone()); return res; }
      catch { return (await c.match(e.request, { ignoreSearch: true })) || (await c.match('index.html')) || (await c.match('./')) || Response.error(); }
    }));
    return;
  }
  // App files: serve from cache, refresh in the background.
  if (url.origin === location.origin || url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; });
      if (hit) { net.catch(() => {}); return hit; }
      return net.catch(() => Response.error());
    }));
  }
});
