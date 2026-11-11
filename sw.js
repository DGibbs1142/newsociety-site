// Makes the site installable/offline-capable. Network-first for the app
// shell (not cache-first) — always serve the freshest HTML/CSS/JS when
// online, only fall back to cache when the network fetch fails. This site's
// whole value is live data, so a service worker that could ever hand back
// stale code (or stale API data) would work against the entire premise.
// Live API calls (cross-origin sources, and our own /api/* functions) are
// never intercepted — they always go straight to the network.

const CACHE_VERSION = 'newsociety-v24';
// Only what the first paint of any page needs. Every page and script a
// visitor actually opens is cached by the fetch handler below as they go,
// so there is no need to download the whole site on the first visit (this
// list used to hold ~40 files, re-fetched by every visitor after each
// deploy bumped CACHE_VERSION).
const APP_SHELL = [
  '/', '/styles.css', '/theme-init.js', '/site.js',
  '/fonts/inter-latin.woff2', '/fonts/anton-latin.woff2', '/fonts/jetbrains-mono-latin.woff2',
  '/icons/icon-192.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  // Videos are streamed in byte ranges (206 responses), which the Cache API
  // refuses, and they are too big to keep offline anyway.
  if (url.pathname.startsWith('/social/') || request.headers.has('range')) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        // Keep only complete, successful same-origin responses, so an offline
        // visitor is never handed a cached 404 or error page.
        if (response.ok && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Push payloads are always our own JSON ({ title, body, url }) sent from
// push-send.mts or push-live-check.mts — never third-party, so no origin
// check is needed here the way there is in the fetch handler above.
self.addEventListener('push', (event) => {
  let data = {};
  try{ data = event.data ? event.data.json() : {}; }catch(e){}
  const title = data.title || 'NewSociety';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' }
  }));
});

// Focuses an already-open tab on the target page rather than always opening
// a new one, same idea as most native notification handling.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients){
        if(client.url === new URL(targetUrl, self.location.origin).href && 'focus' in client) return client.focus();
      }
      if(clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
