const cacheName = 'dam-haji-cache-v1';
const staticAssets = [
  'index.html',
  'style.css',
  'script.js',
  'manifest.json'
];

self.addEventListener('install', async () => {
  const cache = await caches.open(cacheName);
  await cache.addAll(staticAssets);
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
    })
  );
});