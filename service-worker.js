// ⚠️ sube versión para bustear caché
const CACHE_NAME = 'vidatv-cache-v3';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js?v=7',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/logo-full.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = req.url;

  // Nunca cachear HLS ni el proxy de Netlify (stream en vivo)
  if (url.includes('/americabletv/') || url.endsWith('.m3u8') || url.endsWith('.ts')) {
    return event.respondWith(fetch(req).catch(() => caches.match('/index.html')));
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).catch(() => caches.match('/index.html')))
  );
});
