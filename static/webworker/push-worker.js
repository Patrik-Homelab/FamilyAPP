// Web Push and Notification Worker
const DB_NAME = 'familyapp_meta';
const DB_VERSION = 1;
const STORE_NAME = 'badges';

const CATEGORIES = [
    '/timetable',
    '/presents',
    '/debt',
    '/calendar',
    '/shoppinglist',
    '/groups',
    '/users',
    '/notifications',
    '/settings'
];

function openBadgeDB() {
    return new Promise((resolve, reject) => {
        if (!('indexedDB' in self)) {
            return reject(new Error('IndexedDB not supported'));
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'category' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function extractCategory(url) {
    if (!url || typeof url !== 'string') return '';
    const clean = url.replace(/^\/app/, '');
    for (const cat of CATEGORIES) {
        if (clean === cat || clean.startsWith(cat + '/') || clean.startsWith(cat + '?')) {
            return cat;
        }
    }
    return '';
}

async function incrementBadge(category, title, body) {
    if (!category) return;
    try {
        const db = await openBadgeDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const getReq = store.get(category);

            getReq.onsuccess = () => {
                const current = getReq.result || { category, count: 0 };
                current.count = (current.count || 0) + 1;
                current.lastUpdated = Date.now();
                current.latestTitle = title;
                current.latestBody = body;
                store.put(current);
            };

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        // Broadcast to active pages
        try {
            const bc = new BroadcastChannel('familyapp_badges');
            bc.postMessage({ type: 'BADGE_UPDATE', category });
            bc.close();
        } catch {
            // BroadcastChannel may fail if not supported
        }
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to increment notification badge in IndexedDB:', err);
    }
}

async function clearBadge(category) {
    if (!category) return;
    try {
        const db = await openBadgeDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.delete(category);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        try {
            const bc = new BroadcastChannel('familyapp_badges');
            bc.postMessage({ type: 'BADGE_UPDATE', category });
            bc.close();
        } catch {
            // ignore
        }
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to clear badge in IndexedDB:', err);
    }
}

self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        payload = { title: 'Nové oznámení', body: event.data ? event.data.text() : '' };
    }

    const title = payload.title || 'FamilyAPP';
    const rawUrl =
        payload.data && typeof payload.data === 'object' && payload.data.url
            ? payload.data.url
            : payload.url || '';
    const category = extractCategory(rawUrl);

    event.waitUntil(
        Promise.all([
            self.registration.showNotification(title, payload),
            category ? incrementBadge(category, title, payload.body) : Promise.resolve()
        ])
    );
});

self.addEventListener('notificationclick', (event) => {
    const notification = event.notification;
    const data = notification.data || {};
    const defaultUrl = self.location.origin + '/app/';
    const targetUrl =
        'url' in data
            ? data.url.startsWith('/')
                ? self.location.origin + data.url
                : data.url
            : defaultUrl;

    const category = extractCategory('url' in data ? data.url : '');

    event.waitUntil(
        Promise.all([
            category ? clearBadge(category) : Promise.resolve(),
            self.clients
                .matchAll({ type: 'window', includeUncontrolled: true })
                .then((clientList) => {
                    for (const client of clientList) {
                        if (client.url === targetUrl && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    if (self.clients.openWindow) {
                        return self.clients.openWindow(targetUrl);
                    }
                })
        ])
    );

    notification.close();
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CLEAR_BADGE') {
        event.waitUntil(clearBadge(event.data.category));
    }
});
