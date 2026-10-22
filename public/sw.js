// Minimal service worker: makes the web version installable as an app. It doesn't cache anything,
// so every launch loads the newest game build from the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
