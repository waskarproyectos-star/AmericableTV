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

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  const isCross = url.origin !== self.location.origin;
  const isHLS = url.pathname.endsWith('.m3u8') || url.pathname.endsWith('.ts');

  // Deja que el navegador gestione el stream/cross-origin (sin respondWith)
  if (isCross || isHLS) return;

  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(netRes => {
        if (netRes.ok && req.method === 'GET') {
          const copy = netRes.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return netRes;
      }).catch(() => cached || caches.match('/index.html'));
      return cached || fetchPromise;
    })
  );
});
