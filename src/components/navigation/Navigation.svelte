<script lang="ts">
    import { API } from '$/lib/api';
    import { formatUser, SwalAlert } from '$/lib/functions';
    import { badgeStore } from '$/lib/notificationBadges.svelte';
    import { Permissions, type Permission } from '$/lib/permissions';
    import { getState, logged } from '$/lib/state.svelte';
    import { subscribePush, unsubscribePush } from '$/lib/web-push';
    import type { BootstrapIcon } from '$/types/bootstrap_icons';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import { untrack } from 'svelte';
    import { twMerge } from 'tailwind-merge';
    import ClickOutside from '../clickOutside.svelte';
    import Group from '../group.svelte';
    import Icon from '../Icon.svelte';

    const {
        familyUuid,
        familyName,
        haEnabled,
        isFamilyOwner = false
    }: {
        familyUuid: string;
        familyName: string;
        haEnabled: boolean;
        isFamilyOwner?: boolean;
    } = $props();

    const BASE = $derived(`/${familyUuid}`);

    const routes: {
        name: string;
        path: string;
        icon: BootstrapIcon;
        startsWith?: boolean;
        hidden?: boolean;
        permissions?: Permission[];
        ownerAllowed?: boolean;
        requiresHa?: boolean;
    }[] = [
        {
            name: 'Domů',
            path: '',
            icon: 'bi-house-fill'
        },
        {
            name: 'Rozvrhovník',
            path: '/timetable',
            icon: 'bi-calendar2-week'
        },
        {
            name: 'Dárkovník',
            path: '/presents',
            icon: 'bi-gift-fill',
            startsWith: true
        },
        {
            name: 'Dlužníček',
            path: '/debt',
            icon: 'bi-cash-coin',
            startsWith: true
        },
        {
            name: 'Datumovník',
            path: '/calendar',
            icon: 'bi-calendar3'
        },
        {
            name: 'Nákupní seznam',
            path: '/shoppinglist',
            icon: 'bi-cart',
            startsWith: true
        },
        {
            name: 'Teplota vody',
            path: '/water-temperature',
            icon: 'bi-thermometer-half',
            requiresHa: true
        },
        {
            name: 'Nastavení rodiny',
            path: '/family-settings',
            startsWith: true,
            icon: 'bi-house-gear-fill',
            permissions: ['admin.family'],
            ownerAllowed: true
        },
        {
            name: 'Správa skupin',
            path: '/groups',
            startsWith: true,
            icon: 'bi-people-fill',
            permissions: ['admin.groups']
        },
        {
            name: 'Správa uživatelů',
            path: '/users',
            startsWith: true,
            icon: 'bi-key-fill',
            permissions: ['admin.users']
        },
        {
            name: 'Tester notifikací',
            path: '/notifications',
            startsWith: true,
            icon: 'bi-bell-fill',
            permissions: ['admin.notifications']
        },
        {
            name: 'Nastavení',
            path: '/settings',
            icon: 'bi-gear-fill'
        }
    ];

    const _state = getState();

    let route = $derived.by(() => {
        const pathname = page.url.pathname.replace(BASE, '');
        return routes.find((r) =>
            r.startsWith ? pathname.startsWith(r.path) : pathname === r.path
        );
    });

    let totalBadges = $derived(
        Object.values(badgeStore.counts).reduce((acc, count) => acc + count, 0)
    );

    $effect(() => {
        _state.title = route ? route.name : '';
        if (route && route.path) {
            untrack(() => {
                badgeStore.clear(route.path);
            });
        }
    });

    let opened = $state(false);

    const logout = async () => {
        const result = await API.auth.logout();
        if (!result.status) {
            SwalAlert({
                icon: 'error',
                title: 'Nepovedlo se odhlásit'
            });
            return;
        }
        SwalAlert({
            icon: 'success',
            title: 'Byl jsi úspěšně odhlášen'
        });

        _state.userState = {
            logged: false
        };

        goto('/');
    };

    let permissions = $derived(
        new Permissions(logged(_state.userState) ? _state.userState.data : undefined)
    );

    const togglePush = async () => {
        if (_state.pushEnabled) {
            const success = await unsubscribePush();
            if (success) {
                _state.pushEnabled = false;
                SwalAlert({
                    icon: 'success',
                    title: 'Oznámení byla úspěšně vypnuta'
                });
            } else {
                SwalAlert({
                    icon: 'error',
                    title: 'Nepodařilo se vypnout oznámení'
                });
            }
            return;
        }

        const enabled = await subscribePush();
        if (enabled === true) {
            _state.pushEnabled = true;
            SwalAlert({
                icon: 'success',
                title: 'Oznámení byla úspěšně zapnuta'
            });
        } else if (enabled === false) {
            SwalAlert({
                icon: 'error',
                title: 'Nepodařilo se zapnout oznámení'
            });
        } else {
            SwalAlert({
                icon: 'error',
                title: 'Nepovedlo se povolit notifikace',
                text: enabled,
                timer: 10000
            });
        }
    };

    const getInitials = (firstname: string, lastname: string) => {
        return `${firstname.charAt(0)}${lastname.charAt(0)}`.toUpperCase();
    };
</script>

<svelte:head>
    <title>{route?.name ?? ''} | {familyName} | FamilyAPP</title>
</svelte:head>

<!-- Mobile Sticky Top Bar -->
<header
    class="bg-secondary/90 sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 backdrop-blur-md md:hidden"
>
    <div class="flex items-center gap-3">
        <button
            type="button"
            onclick={() => (opened = true)}
            class="bg-background/70 hover:bg-accent/15 hover:border-accent/40 relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-white/15 transition-colors"
            aria-label="Otevřít menu"
        >
            <Icon name="bi-list" class="text-2xl" />
            {#if totalBadges > 0}
                <span
                    class="bg-accent absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white shadow"
                >
                    {totalBadges > 99 ? '99+' : totalBadges}
                </span>
            {/if}
        </button>
        <div class="flex flex-col">
            <span class="text-text/50 text-xs font-medium">{familyName}</span>
            <h1 class="font-poppins text-lg leading-tight font-bold">
                {_state.title || 'FamilyAPP'}
            </h1>
        </div>
    </div>

    <button
        type="button"
        onclick={togglePush}
        class={[
            'flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border text-base transition-colors',
            _state.pushEnabled
                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
                : 'border-white/15 bg-white/5 text-red-400'
        ]}
        title={_state.pushEnabled ? 'Notifikace zapnuty' : 'Notifikace vypnuty'}
        aria-label="Přepnout oznámení"
    >
        <Icon name={_state.pushEnabled ? 'bi-bell-fill' : 'bi-bell-slash'} />
    </button>
</header>

<!-- Mobile Backdrop -->
{#if opened}
    <div
        class="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        aria-hidden="true"
    ></div>
{/if}

<!-- Sidebar Navigation -->
<ClickOutside
    clickoutside={() => (opened = false)}
    class={twMerge(
        'bg-secondary/95 fixed top-0 left-0 z-50 flex h-screen w-72 flex-col border-r border-white/10 p-4 backdrop-blur-xl transition-transform duration-300 md:sticky md:top-0 md:z-10 md:w-72 md:shrink-0 md:translate-x-0',
        !opened ? '-translate-x-full' : 'translate-x-0'
    )}
>
    <!-- Brand + Mobile Close -->
    <div class="mb-4 flex items-center justify-between gap-2">
        <a href={BASE} onclick={() => (opened = false)} class="flex items-center gap-2.5">
            <div
                class="bg-accent/15 text-accent border-accent/30 flex h-9 w-9 items-center justify-center rounded-xl border text-lg shadow-xs"
            >
                <Icon name="bi-house-heart-fill" />
            </div>
            <div class="flex flex-col">
                <span
                    class="font-poppins text-base leading-tight font-bold tracking-tight"
                    >FamilyAPP</span
                >
                <span class="text-text/60 max-w-40 truncate text-xs font-medium"
                    >{familyName}</span
                >
            </div>
        </a>

        <button
            type="button"
            onclick={() => (opened = false)}
            class="text-text/70 hover:text-text flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg hover:bg-white/10 md:hidden"
            aria-label="Zavřít menu"
        >
            <Icon name="bi-x-lg" class="text-lg" />
        </button>
    </div>

    <!-- User Profile Card -->
    {#if logged(_state.userState)}
        {@const data = _state.userState.data}
        <div
            class="bg-background/60 mb-4 flex flex-col gap-2.5 rounded-xl border border-white/10 p-3"
        >
            <div class="flex items-center gap-2.5">
                <div
                    class="bg-accent/20 text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                >
                    {getInitials(data.firstname, data.lastname)}
                </div>
                <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-bold">{formatUser(data)}</p>
                    <p class="text-text/50 truncate text-xs">@{data.username}</p>
                </div>
                <button
                    type="button"
                    onclick={logout}
                    class="text-text/60 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-red-500/15 hover:text-red-400"
                    title="Odhlásit se"
                    aria-label="Odhlásit se"
                >
                    <Icon name="bi-box-arrow-right" class="text-lg" />
                </button>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2">
                {#if data.group}
                    {@const group = data.group}
                    <Group textColor={group.text_color} backgroundColor={group.bg_color}>
                        {group.name}
                    </Group>
                {:else}
                    <span class="text-text/40 text-xs">Bez skupiny</span>
                {/if}

                <button
                    type="button"
                    onclick={togglePush}
                    class={[
                        'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
                        _state.pushEnabled
                            ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                            : 'border-white/10 bg-white/5 text-red-400 hover:bg-white/10'
                    ]}
                >
                    <Icon name={_state.pushEnabled ? 'bi-bell-fill' : 'bi-bell-slash'} />
                    <span>{_state.pushEnabled ? 'Zapnuto' : 'Vypnuto'}</span>
                </button>
            </div>
        </div>
    {/if}

    <!-- Navigation Links -->
    <nav class="flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {#each routes.filter((r) => {
            const perms = r.permissions ? r.permissions.some( (perm) => permissions.hasPermission(perm) ) || (r.ownerAllowed && isFamilyOwner) : true;
            const hidden = r.hidden !== undefined ? !r.hidden : true;
            const haOk = r.requiresHa ? haEnabled : true;

            return perms && hidden && haOk;
        }) as _route, i (i)}
            {@const badgeCount = _route.path ? badgeStore.counts[_route.path] || 0 : 0}
            {@const isActive = _route.name === route?.name}
            <a
                href="{BASE}{_route.path}"
                onclick={() => {
                    opened = false;
                    if (_route.path) badgeStore.clear(_route.path);
                }}
                class={[
                    'font-poppins flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all duration-150',
                    isActive
                        ? 'bg-accent/15 text-accent border-accent/30 shadow-xs'
                        : 'text-text/75 hover:text-text border-transparent hover:bg-white/[0.06]'
                ]}
            >
                <span class="flex items-center gap-3">
                    <Icon name={_route.icon} class="text-base" />
                    <span>{_route.name}</span>
                </span>
                {#if badgeCount > 0}
                    <span
                        class="bg-accent inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white shadow"
                    >
                        {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                {/if}
            </a>
        {/each}
    </nav>
</ClickOutside>
