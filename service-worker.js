// Bump the cache version when the precached asset LIST changes (files added
// or removed). Day-to-day code changes do NOT need a bump: the fetch strategy
// below revalidates assets against the network, so deploys propagate on their
// own and offline starts still work from cache.
const cacheName = 'dam-haji-cache-v7';
const staticAssets = [
  'index.html',
  'style.css',
  'game.js',
  'ai.js',
  'ai-worker.js',
  'script.js',
  'ui-v2.js',
  'integration-v2.js',
  'notifications.js',
  'menu-system.js',
  'settings-system.js',
  'history-system.js',
  'manifest.json',
  'favicon.ico',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', async () => {
  const cache = await caches.open(cacheName);
  await cache.addAll(staticAssets);
  // Apply updates on the next launch instead of waiting for every client
  // to close — otherwise users can run stale code for extra sessions.
  await self.skipWaiting();
  console.log('Service worker: Caching static assets');
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Navigations (the app shell): network-first so deploys land on the next
  // launch; fall back to cache when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(cacheName).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
    );
    return;
  }

  // Static assets: stale-while-revalidate — serve instantly from cache and
  // refresh the copy in the background, so the NEXT load is always current.
  if (req.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(req).then(hit => {
        const refresh = fetch(req)
          .then(res => {
            const copy = res.clone();
            caches.open(cacheName).then(cache => cache.put(req, copy));
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      })
    );
  }
  // Everything else (cross-origin): let the browser handle it.
});

self.addEventListener('activate', (event) => {
  console.log('Service worker: Activating new service worker...');

  const cacheWhitelist = [cacheName];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service worker: Clearing old cache');
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});