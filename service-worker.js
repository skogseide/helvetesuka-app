const CACHE_NAME = 'helvetesuka-cache-v1';
const ASSETS = [
  'index.html',
  'index.css',
  'index.js',
  'manifest.json',
  'assets/background.png',
  'assets/favicon.png'
];

// Install event - caching assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(ASSETS);
    })
  );
  // Force activation of service worker immediately
  self.skipWaiting();
});

// Activate event - cleaning up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  // Claim clients so the service worker controls them immediately
  self.clients.claim();
});

// Fetch event - cache-first strategy
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then((networkResponse) => {
        // If valid, return response
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          // Optional: dynamically cache new requests
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fail gracefully offline if resource is not cached
        return new Response('Du er offline, og denne ressursen er ikke tilgjengelig.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain; charset=UTF-8' })
        });
      });
    })
  );
});
