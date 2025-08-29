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
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)));
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

  // 1) NO interceptar nada que no sea de MISMO ORIGEN (muy importante para el HLS en stream.americabletv.com)
  if (url.origin !== self.location.origin) {
    return; // dejamos que el navegador lo maneje (sin SW)
  }

  // 2) No cachear ni hacer fallback para recursos HLS si algún día los sirvieras en mismo origen
  if (url.pathname.endsWith('.m3u8') || url.pathname.includes('/americabletv/')) {
    event.respondWith(fetch(req));
    return;
  }

  // 3) Solo fallback a index.html en NAVEGACIONES de mismo origen (SPA)
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const network = await fetch(req);
          return network;
        } catch (e) {
          return caches.match('/index.html');
        }
      })()
    );
    return;
  }

  // 4) Estrategia cache-first simple para assets de mismo origen
  event.respondWith(
    caches.match(req).then(resp => resp || fetch(req).then(r => {
      // opcional: guardar en cache dinámico
      return r;
    }).catch(() => {
      // si falla y es un asset, no devolvemos index.html salvo que sea navegación (ya cubierto arriba)
      return caches.match(req);
    }))
  );
});
