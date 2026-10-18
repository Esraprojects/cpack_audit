/* CPack Audit service worker: lets the installed app open on weak or no internet.
   Network first, so updates (like a new js/config.js) show up as soon as you are online;
   the saved copy is used only when the network fails. Records are synced by Firebase itself. */
var CACHE = 'cpack-audit-v4';
var SHELL = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './icons/logo.png', './icons/favicon-64.png', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './js/config.js', './js/cloud.js', './js/store.js', './js/charts.js', './js/insights.js', './js/ai.js', './js/setup.js', './js/app.js',
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore-compat.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var isShell = url.origin === self.location.origin || url.href.indexOf('https://www.gstatic.com/firebasejs/') === 0;
  if (!isShell) return; // Firebase data, logins and the AI service always go straight to the network
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined);
      });
    })
  );
});
