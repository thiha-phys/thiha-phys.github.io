const CACHE_NAME = 'physics-learning-hub-v3';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './manifest.webmanifest',
    './logo.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './page/login.html',
    './page/contact.html',
    './page/contact.css',
    './page/bookstores.html',
    './page/bookstores.css',
    './page/bookstores.js',
    './page/books.html',
    './page/books.css',
    './page/books-data.js',
    './page/books.js',
    './page/book-preview.html',
    './page/book-preview.js',
    './page/order.html',
    './page/order.js',
    './page/order-api.js',
    './page/order-history.html',
    './page/order-history.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(cacheName => cacheName.startsWith('physics-learning-hub-') && cacheName !== CACHE_NAME)
                    .map(cacheName => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
        return;
    }

    event.respondWith((async () => {
        let response;
        try {
            response = await fetch(request);
        } catch (error) {
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
                return cachedResponse;
            }
            throw error;
        }

        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
        }
        return response;
    })());
});
