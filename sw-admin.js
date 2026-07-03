// Samarpan Admin — Service Worker
// Required for the browser's "Install App" prompt to appear.
// Keeps the shell cached so the panel opens instantly (data still loads
// live from Firestore — this does NOT cache your leads/bookings/etc).

const CACHE_NAME = 'samarpan-admin-shell-v1';
const SHELL_FILES = [
  './admin.html',
  './manifest-admin.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Network-first: always try to get the freshest admin panel + data.
// Falls back to cached shell only if the network is unavailable
// (e.g. brief connectivity drop), so you're never stuck on stale JS.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
