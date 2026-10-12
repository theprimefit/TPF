// Lets phones install the dashboard as an app. Everything still loads live from
// the server (leads must always be current), so nothing is cached.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
