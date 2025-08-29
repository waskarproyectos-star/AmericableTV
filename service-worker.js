// ⚠️ cambia la versión para forzar que todos actualicen
const CACHE_NAME = 'vidatv-cache-v3';

const ASSETS = [
  '/',                // tu página
  '/index.html',
  '/styles.css?v=4',  // nota el ?v=4 para bustear
  '/script.js?v=4',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/logo-full.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS))
  );
  // que tome control inmediato
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // elimina cachés viejas
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()))
    )
  );
  // toma control de las pestañas abiertas
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 1) NUNCA interceptar el streaming ni cross-origin
  //    (m3u8/ts o cualquier recurso fuera de tu dominio)
  const url = new URL(req.url);
  const isCross = url.origin !== self.location.origin;
  const isHLS = url.pathname.endsWith('.m3u8') || url.pathname.endsWith('.ts');

  if (isCross || isHLS || url.pathname.startsWith('/americabletv/')) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // 2) Para tus assets: cache-first con revalidación básica
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((netRes) => {
        const copy = netRes.clone();
        // guarda solo si es mismo origen y OK
        if (netRes.ok && req.method === 'GET') {
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return netRes;
      }).catch(() => cached || caches.match('/index.html'));
      return cached || fetchPromise;
    })
  );
});
