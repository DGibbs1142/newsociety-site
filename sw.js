// Makes the site installable/offline-capable. Network-first for the app
// shell (not cache-first) — always serve the freshest HTML/CSS/JS when
// online, only fall back to cache when the network fetch fails. This site's
// whole value is live data, so a service worker that could ever hand back
// stale code (or stale API data) would work against the entire premise.
// Live API calls (cross-origin sources, and our own /api/* functions) are
// never intercepted — they always go straight to the network.

const CACHE_VERSION = 'newsociety-v7';
const APP_SHELL = [
  '/', '/index.html', '/sports.html', '/anime.html', '/pop-culture.html',
  '/fashion.html', '/music.html', '/current-events.html', '/detail.html',
  '/search.html', '/saved.html', '/about.html', '/faq.html',
  '/live.html', '/production.html', '/host.html', '/get-involved.html', '/press.html',
  '/links.html', '/careers.html', '/thanks.html',
  '/styles.css',
  '/site.js', '/detail-link.js', '/search-widget.js', '/get-involved.js',
  '/sports.js', '/anime.js', '/pop-culture.js', '/fashion.js', '/music.js', '/news.js',
  '/detail.js', '/global-search.js', '/saved.js', '/homepage-live.js',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-512-maskable.png'
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

  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
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
