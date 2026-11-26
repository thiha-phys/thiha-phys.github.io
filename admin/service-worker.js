// Bump the shell cache whenever auth/navigation scripts change. The previous
// cache-first strategy could keep an older admin-api.js and cause login loops.
const CACHE_NAME = 'uthk-admin-shell-v39';
const APP_FILES = [
    './index.html',
    './style.css',
    './logo.png',
    './manifest.webmanifest',
    './icons/app-icon-192.png',
    './icons/app-icon-512.png',
    './pages/admin-api.js',
    './pages/home.js',
    './pages/admin-nav.js',
    './pages/tools.html',
    './pages/learning-content.html',
    './pages/learning-content.js',
    './pages/pending-users.html',
    './pages/profiles.html',
    './pages/profiles.js',
    './pages/password-reset-requests.html',
    './pages/password-reset-requests.js',
    './pages/bookstores.html',
    './pages/bookstores.js',
    './pages/announcements.html',
    './pages/announcements.js',
    './pages/order-profiles.html',
    './pages/order-profiles.js',
    './pages/feedback.html',
    './pages/feedback.js',
    './pages/masterdata.html',
    './pages/masterdata.js',
    './pages/historyorder.html',
    './pages/historyorder.js',
    './pages/createorder.html',
    './pages/createorder.js',
    './pages/receipt-actions.js',
    './pages/chnagerequest.html',
    './pages/chnagerequest.js',
    './pages/createvoucher.html',
    './pages/createvoucher.js',
    './pages/royal-sync.html',
    './pages/royal-import.js',
    './pages/checkstock.html',
    './pages/checkstock.js',
    './pages/shops.html',
    './pages/shops.js',
    './pages/shop.html',
    './pages/shop.js',
    './pages/shop-order.html',
    './pages/shop-order.js',
    './pages/shop-history.html',
    './pages/shop-history.js',
    './pages/undelivered-shop-orders.html',
    './pages/undelivered-shop-orders.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key.startsWith('uthk-admin-shell-') && key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(async () => {
                const cached = await caches.match(request);
                return cached || caches.match(new URL('./index.html', self.registration.scope).href);
            })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => cached || fetch(request).then((response) => {
            if (response.ok) {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
        }))
    );
});
