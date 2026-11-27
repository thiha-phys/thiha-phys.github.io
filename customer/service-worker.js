const CACHE_NAME = 'physics-learning-hub-v49';
const APP_SHELL = [
    './',
    './index.html',
    './auth-guard.js',
    './style.css',
    './page/brand.css',
    './manifest.webmanifest',
    './logo.png',
    './pictures/uthk.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './page/login.html',
    './page/forgot-password.html',
    './page/pending.html',
    './page/contact.html',
    './page/account.html',
    './page/profile.html',
    './page/edit-profile.html',
    './page/discussion.html',
    './page/discussion.css',
    './page/discussion.js',
    './page/order-history.html',
    './page/profile-api.js',
    './page/api-config.js',
    './page/announcement-notice.js',
    './page/announcements.js',
    './page/announcement.html',
    './page/contact.css',
    './page/bookstores.html',
    './page/bookstores.css',
    './page/bookstores.js',
    './page/books.html',
    './page/books.css',
    './page/books-data.js',
    './page/books.js',
    './page/order-master-api.js',
    './page/book-preview.html',
    './page/book-preview.js',
    './preview/preview.css',
    './preview/lesson-preview.js',
    './preview/preDefG10.html',
    './preview/preDefG11.html',
    './preview/preDefG12.html',
    './preview/preDefG10.data.js',
    './preview/preDefG11.data.js',
    './preview/preDefG12.data.js',
    './preview/preCalG10.html',
    './preview/preCalG11.html',
    './preview/preCalG12.html',
    './preview/preObjG10.html',
    './preview/preObjG11.html',
    './preview/preObjG12.html',
    './preview/preObjG10.data.js',
    './preview/preObjG11.data.js',
    './preview/preObjG12.data.js',
    './page/order.html',
    './page/order.js',
    './page/order-api.js'
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
