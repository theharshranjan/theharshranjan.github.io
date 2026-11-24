/* GiftBook service worker: app opens instantly and works with no internet. Bump V when you change files. */
var V = 'giftbook-v1';
var SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'invite.jpg', 'icon-192.png', 'apple-touch-icon.png'];
var EXTRA = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)\//;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;               // saves to Apps Script are never touched
  var url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(caches.open(V).then(function (c) {
      return c.match(req, { ignoreSearch: true }).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.ok && !res.redirected) c.put(req, res.clone());
          return res;
        }).catch(function () { return null; });
        if (hit) return hit;                       // instant from cache, refreshed in background
        return net.then(function (res) {
          return res || (req.mode === 'navigate' ? c.match('index.html') : Response.error());
        });
      });
    }));
  } else if (EXTRA.test(req.url)) {
    e.respondWith(caches.open(V).then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { c.put(req, res.clone()); return res; });
      });
    }));
  }
});
