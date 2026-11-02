<script lang="ts">
    import Footer from '$/components/navigation/Footer.svelte';
    import Navigation from '$/components/navigation/Navigation.svelte';
    import { API } from '$/lib/api';
    import { SwalAlert } from '$/lib/functions';
    import { badgeStore } from '$/lib/notificationBadges.svelte';
    import { getState, logged } from '$/lib/state.svelte';
    import { subscribePush } from '$/lib/web-push';
    import { browser } from '$app/environment';
    import { goto, preloadData } from '$app/navigation';
    import { onMount, type Snippet } from 'svelte';
    import { UAParser } from 'ua-parser-js';
    import type { PageData } from './$types';

    const { children, data }: { children: Snippet; data: PageData } = $props();

    const _state = getState();
    const PERMS_UPDATE = 5 * 60 * 1000; // 5 minutes

    let isIphone = $state(false);
    if (browser) {
        const parsed = UAParser(navigator.userAgent);
        isIphone = parsed.os.is('iOS');
    }

    const warmOfflineCache = async () => {
        if (!browser || !navigator.onLine) return;
        // Warm the app root navigation page
        fetch('/app').catch(() => {});

        const routesToWarm = [
            '/app/presents/mine',
            '/app/presents/others',
            '/app/debt',
            '/app/shoppinglist',
            '/app/calendar'
        ];

        for (const route of routesToWarm) {
            try {
                const res = await preloadData(route);
                if (res && res.type === 'loaded' && res.data) {
                    const loadedData = res.data as Record<string, unknown>;
                    const imagesToCache: string[] = [];

                    const inspectList = (list: unknown) => {
                        if (Array.isArray(list)) {
                            for (const item of list) {
                                if (item && typeof item === 'object') {
                                    const entry = item as Record<string, unknown>;
                                    if (typeof entry.image === 'string' && entry.image) {
                                        imagesToCache.push(entry.image);
                                    }
                                    if (typeof entry.photo === 'string' && entry.photo) {
                                        imagesToCache.push(entry.photo);
                                    }
                                }
                            }
                        }
                    };

                    inspectList(loadedData.data);
                    inspectList(loadedData.who);
                    inspectList(loadedData.whom);

                    for (const imgName of imagesToCache.slice(0, 40)) {
                        const imgUrl = `/images/${encodeURIComponent(imgName)}?format=jpg&quality=75`;
                        fetch(imgUrl, { mode: 'no-cors' }).catch(() => {});
                    }
                }
            } catch {
                // Ignore prefetch errors in background
            }
        }
    };

    onMount(() => {
        if (!logged(_state.userState)) return;

        // Initialize notification badge sync
        badgeStore.init();

        // Register Service Worker for PWA offline caching
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
        }

        // Warm cache in background after a slight delay
        const cacheWarmTimer = setTimeout(() => {
            warmOfflineCache();
        }, 2000);

        if (!isIphone) {
            subscribePush().then((value) => {
                if (typeof value === 'boolean') {
                    _state.pushEnabled = value;
                    return;
                }

                SwalAlert({
                    icon: 'error',
                    title: 'Nepovedlo se povolit notifikace',
                    text: value
                });
            });
        }

        const data = _state.userState.data;

        const interval = setInterval(async () => {
            const fetched = await API.permissions.GET();
            if (!fetched.status) {
                // Logged out
                _state.userState = {
                    logged: false
                };
                goto('/');
                return;
            }

            data.permissions = fetched.data.permissions;
            data.group = fetched.data.group;
        }, PERMS_UPDATE);

        return () => {
            clearInterval(interval);
            clearTimeout(cacheWarmTimer);
        };
    });
</script>

<section class="flex flex-1 flex-col md:flex-row">
    <Navigation />
    <div class="flex w-full flex-1 flex-col p-2">
        {@render children()}
        <Footer version={data.version} />
    </div>
</section>
