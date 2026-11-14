// TrueEnhance AI Studio Service Worker
const CACHE_NAME = 'trueenhance-v2';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon.svg',
  '/favicon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache addAll warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Never intercept non-GET, API calls, Vite dev modules, or source files
  if (
    event.request.method !== 'GET' ||
    url.includes('/api/') ||
    url.includes('/@vite/') ||
    url.includes('/@react-refresh') ||
    url.includes('/src/') ||
    url.includes('/node_modules/') ||
    url.includes('?v=') ||
    url.includes('?t=')
  ) {
    return;
  }

  // Only cache static app shell icons/manifest; keep HTML/navigation network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  const isStaticIconOrAsset = STATIC_ASSETS.some((asset) => url.endsWith(asset));
  if (!isStaticIconOrAsset) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, toCache));
        }
        return response;
      });
    })
  );
});
