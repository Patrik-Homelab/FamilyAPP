import { browser } from '$app/environment';

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

export function extractCategoryFromUrl(url: string | null | undefined): string {
    if (!url) return '';
    const clean = url.replace(/^\/app/, '');
    for (const cat of CATEGORIES) {
        if (clean === cat || clean.startsWith(cat + '/') || clean.startsWith(cat + '?')) {
            return cat;
        }
    }
    return '';
}

function openBadgeDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (!browser || !('indexedDB' in window)) {
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

export async function getStoredBadgeCounts(): Promise<Record<string, number>> {
    if (!browser) return {};
    try {
        const db = await openBadgeDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();

            req.onsuccess = () => {
                const results: Record<string, number> = {};
                for (const item of req.result || []) {
                    if (item.category && item.count > 0) {
                        results[item.category] = item.count;
                    }
                }
                resolve(results);
            };
            req.onerror = () => reject(req.error);
        });
    } catch {
        return {};
    }
}

export async function clearBadgeForCategory(category: string): Promise<void> {
    if (!browser || !category) return;
    try {
        const db = await openBadgeDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(category);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });

        // Inform service worker if active
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'CLEAR_BADGE',
                category
            });
        }

        // Broadcast to other tabs
        try {
            const bc = new BroadcastChannel('familyapp_badges');
            bc.postMessage({ type: 'BADGE_UPDATE', category });
            bc.close();
        } catch {
            // ignore
        }
    } catch {
        // ignore
    }
}

class BadgeStore {
    counts = $state<Record<string, number>>({});
    private initialized = false;
    private channel: BroadcastChannel | null = null;

    init() {
        if (!browser || this.initialized) return;
        this.initialized = true;

        this.refresh();

        try {
            this.channel = new BroadcastChannel('familyapp_badges');
            this.channel.onmessage = () => {
                this.refresh();
            };
        } catch {
            // ignore
        }

        window.addEventListener('focus', () => {
            this.refresh();
        });
    }

    async refresh() {
        if (!browser) return;
        const stored = await getStoredBadgeCounts();

        // Also check if any active notifications in notification center
        if ('serviceWorker' in navigator) {
            try {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg && 'getNotifications' in reg) {
                    const activeNotifications = await reg.getNotifications();
                    for (const notif of activeNotifications) {
                        const rawUrl =
                            notif.data && typeof notif.data === 'object' && notif.data.url
                                ? notif.data.url
                                : '';
                        const cat = extractCategoryFromUrl(rawUrl);
                        if (cat && (!stored[cat] || stored[cat] === 0)) {
                            stored[cat] = 1;
                        }
                    }
                }
            } catch {
                // ignore
            }
        }

        this.counts = stored;
    }

    async clear(category: string) {
        if (!category) return;
        if (this.counts[category]) {
            const next = { ...this.counts };
            delete next[category];
            this.counts = next;
        }
        await clearBadgeForCategory(category);
    }
}

export const badgeStore = new BadgeStore();
