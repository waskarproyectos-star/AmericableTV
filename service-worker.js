const CACHE_NAME = 'vidatv-cache-v1';
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
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // limpieza caches viejos
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => {
        if (k !== CACHE_NAME) return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // No cachear la petición HLS para evitar problemas (stream en vivo)
  if (request.url.includes('.m3u8') || request.url.includes('/americabletv/')) {
    return event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
  }

  event.respondWith(
    caches.match(request).then(resp => resp || fetch(request).catch(() => caches.match('/index.html')))
  );
});
