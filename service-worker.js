// Bump the cache version on EVERY change to cached assets — the cache-first
// strategy serves stale scripts to installed PWAs otherwise.
const cacheName = 'dam-haji-cache-v6';
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
    event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  console.log(`Service worker: Fetching resource ${req.url}`);
  const cachedResponse = await caches.match(req);
  return cachedResponse || fetch(req);
}

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