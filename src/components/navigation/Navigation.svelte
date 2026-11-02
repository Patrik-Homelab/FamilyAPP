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
    import Title from '../headers/Title.svelte';
    import Icon from '../Icon.svelte';

    const BASE = '/app' as const;
    const routes: {
        name: string;
        path: string;
        icon: BootstrapIcon;
        startsWith?: boolean;
        hidden?: boolean;
        permissions?: Permission[];
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
        /*{
            name: 'Poznámkovník',
            path: '/notes',
            icon: 'bi-stickies-fill'
        },*/
        {
            name: 'Nákupní seznam',
            path: '/shoppinglist',
            icon: 'bi-cart',
            startsWith: true
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
        },
        {
            name: 'Seznam změn',
            path: '/changelog',
            icon: 'bi-list',
            hidden: true
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
</script>

<svelte:head>
    <title>{route?.name ?? ''} | FamilyAPP</title>
</svelte:head>

<div class="flex items-center gap-2 p-2 md:hidden">
    <div class="relative">
        <Icon
            onclick={() => (opened = true)}
            name="bi-list"
            class="border-primary bg-secondary hover:bg-accent active:bg-accent rounded-md border-[1px] px-1.5 py-0.5 text-3xl font-bold transition-colors duration-200"
        />
        {#if totalBadges > 0}
            <span
                class="bg-accent text-background absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px] font-bold shadow"
            >
                {totalBadges > 99 ? '99+' : totalBadges}
            </span>
        {/if}
    </div>
    <Title>{_state.title}</Title>
</div>

<ClickOutside
    clickoutside={() => (opened = false)}
    class={twMerge(
        'bg-secondary absolute top-0 left-0 z-50 flex min-h-screen w-1/2 min-w-96 flex-col p-2 transition-transform duration-500 md:static md:w-auto md:translate-x-0',
        !opened ? '-translate-x-full' : ''
    )}
>
    <div class="flex flex-row justify-between px-2 md:justify-end">
        <Icon
            onclick={() => (opened = false)}
            name="bi-x-lg"
            class="text-3xl font-bold md:hidden"
        />
        <Icon onclick={logout} name="bi-box-arrow-in-right" class="text-3xl font-bold" />
    </div>
    <div class="flex flex-col items-center justify-center gap-2">
        <Title>Uživatelské menu:</Title>
        {#if logged(_state.userState)}
            {@const data = _state.userState.data}
            <h1 class="font-poppins font-bold">
                {formatUser(data)}
                {#if data.group}
                    {@const group = data.group}
                    <Group textColor={group.text_color} backgroundColor={group.bg_color}>
                        {group.name}
                    </Group>
                {/if}
            </h1>
        {/if}
        <h1 class="font-poppins font-bold">
            Oznámení: <Icon
                onclick={togglePush}
                name={_state.pushEnabled ? 'bi-bell-fill' : 'bi-bell-slash'}
                class={_state.pushEnabled ? 'text-green-500' : 'text-red-500'}
            />
        </h1>
    </div>
    <hr class="my-4" />
    <div class="flex flex-1 flex-col items-center justify-center gap-2">
        <div class="flex h-full w-max flex-1 flex-col gap-2 overflow-y-auto">
            {#each routes.filter((route) => {
                const perms = route.permissions ? route.permissions.some( (perm) => permissions.hasPermission(perm) ) : true;
                const hidden = route.hidden !== undefined ? !route.hidden : true;

                return perms && hidden;
            }) as _route, i (i)}
                {@const badgeCount = _route.path
                    ? badgeStore.counts[_route.path] || 0
                    : 0}
                <a
                    class:border-b-2={_route.name == route?.name}
                    class:hover:after:scale-x-100={_route.name != route?.name}
                    href="/app{_route.path}"
                    onclick={() => {
                        opened = false;
                        if (_route.path) badgeStore.clear(_route.path);
                    }}
                    class="border-b-text font-poppins after:bg-text flex w-max items-center gap-2 text-2xl font-bold after:block after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:transition-transform after:duration-200"
                >
                    <Icon name={_route.icon} />
                    <span>{_route.name}</span>
                    {#if badgeCount > 0}
                        <span
                            class="bg-accent ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold text-white shadow"
                        >
                            {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                    {/if}
                </a>
            {/each}
        </div>
    </div>
</ClickOutside>
