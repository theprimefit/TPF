/* Offline cache for Hindivine Admin (installed web app). */
const CACHE = 'hindivine-admin-v20';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/admin.css', 'js/config.js', 'js/core.js', 'js/export.js', 'js/app.js', 'vendor/jspdf.umd.min.js', 'vendor/jspdf.plugin.autotable.min.js', 'vendor/xlsx.mini.min.js', 'vendor/fonts/PlusJakartaSans-latin.woff2',
  '../img/logo.jpg', '../img/icon-192.png', '../img/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hindivine-admin') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first so updates arrive quickly; fall back to the cache when offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
