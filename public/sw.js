// public/sw.js
const CACHE_NAME = 'japan-delivery-pro-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
  // logo bad mein add karna
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.log('SW install skipped (normal in dev):', err))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request).catch(() => caches.match('/index.html')))
  );
});