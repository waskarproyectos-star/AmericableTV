// /service-worker.js  (asegúrate que el nombre coincida con el del registro)
const CACHE_NAME = 'vidatv-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/logo-full.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) NO interceptar recursos de OTRO ORIGEN (ej. https://stream.americabletv.com)
  if (url.origin !== self.location.origin) return;

  // 2) Si algún día sirves HLS desde el MISMO origen, tampoco lo caches
  if (url.pathname.endsWith('.m3u8') || url.pathname.includes('/americabletv/')) {
    event.respondWith(fetch(req));
    return;
  }

  // 3) Fallback a index.html SOLO para NAVEGACIONES del mismo origen (SPA)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(req); }
      catch { return caches.match('/index.html'); }
    })());
    return;
  }

  // 4) Cache-first simple para assets de tu dominio
  event.respondWith(
    caches.match(req).then(r => r || fetch(req).catch(() => caches.match(req)))
  );
});
