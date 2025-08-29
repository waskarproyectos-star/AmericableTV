// ⚠️ sube versión para bustear caché
const CACHE_NAME = 'vidatv-cache-v4';

const ASSETS = [
  '/',
  '/index.html',
  '/styles.css?v=5',
  '/script.js?v=5',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/logo-full.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
  );
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const isCross = url.origin !== self.location.origin;
  const isHLS = url.pathname.endsWith('.m3u8') || url.pathname.endsWith('.ts');

  // Nunca cachear HLS ni recursos de otros orígenes
  if (isCross || isHLS || url.pathname.startsWith('/americabletv/')) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // Cache-first con actualización en segundo plano
  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(netRes => {
        const copy = netRes.clone();
        if (netRes.ok && req.method === 'GET') {
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return netRes;
      }).catch(() => cached || caches.match('/index.html'));
      return cached || fetchPromise;
    })
  );
});
