/**
 * Service Worker — cache-first for assets, network-first for navigation.
 *
 * Cache is versioned by CACHE_NAME. On activate, old caches are purged.
 * The build injects no variables — the SW caches lazily on first fetch
 * rather than pre-caching a manifest, keeping things simple.
 */

const CACHE_NAME = 'td-cache-v2';

// Asset extensions worth caching (sprites, audio, fonts, compiled JS/CSS)
const CACHEABLE = /\.(js|css|woff2?|ttf|png|jpe?g|svg|webp|ico|json|mp3|ogg|wav)$/i;

self.addEventListener('install', (event) => {
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Navigation requests (HTML pages) — network-first so updates land immediately
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cacheable assets — cache-first for speed, fall back to network
  const url = new URL(request.url);
  if (CACHEABLE.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // Only cache successful same-origin responses
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else — just fetch normally
});
