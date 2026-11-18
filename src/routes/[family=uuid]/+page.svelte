<script lang="ts">
    import Title from '$/components/headers/Title.svelte';
    import Icon from '$/components/Icon.svelte';
    import { eventIsInDay, getEventName, getEventRange } from '$/lib/calendarUtils';
    import { formatUser, locale } from '$/lib/functions';
    import { getState, logged } from '$/lib/state.svelte';
    import type { BootstrapIcon } from '$/types/bootstrap_icons';
    import { SvelteDate } from 'svelte/reactivity';
    import type { PageProps } from './$types';

    const { data }: PageProps = $props();
    const _state = getState();

    const shortcuts: {
        name: string;
        desc: string;
        path: string;
        icon: BootstrapIcon;
        color: string;
        requiresHa?: boolean;
    }[] = [
        {
            name: 'Datumovník',
            desc: 'Sdílený rodinný kalendář',
            path: '/calendar',
            icon: 'bi-calendar3',
            color: 'text-sky-400 bg-sky-500/15 border-sky-500/25'
        },
        {
            name: 'Nákupní seznam',
            desc: 'Položky k nákupu',
            path: '/shoppinglist',
            icon: 'bi-cart',
            color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25'
        },
        {
            name: 'Dárkovník',
            desc: 'Seznam přání a rezervací',
            path: '/presents/others',
            icon: 'bi-gift-fill',
            color: 'text-rose-400 bg-rose-500/15 border-rose-500/25'
        },
        {
            name: 'Dlužníček',
            desc: 'Přehled půjček a plateb',
            path: '/debt',
            icon: 'bi-cash-coin',
            color: 'text-amber-400 bg-amber-500/15 border-amber-500/25'
        },
        {
            name: 'Rozvrhovník',
            desc: 'Týdenní rozvrhy a rutina',
            path: '/timetable',
            icon: 'bi-calendar2-week',
            color: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/25'
        },
        {
            name: 'Teplota vody',
            desc: 'Aktuální graf z Home Assistant',
            path: '/water-temperature',
            icon: 'bi-thermometer-half',
            color: 'text-orange-400 bg-orange-500/15 border-orange-500/25',
            requiresHa: true
        }
    ];

    const haActive = $derived(
        logged(_state.userState) ? _state.userState.data.ha_enabled : data.haEnabled
    );
</script>

<section class="flex flex-1 flex-col gap-6 pb-6">
    <!-- Welcome Banner -->
    <div
        class="bg-secondary/80 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 p-5 shadow-md"
    >
        <div class="flex flex-col gap-1">
            <span class="text-text/60 text-xs font-semibold tracking-wider uppercase">
                {logged(_state.userState)
                    ? _state.userState.data.family_name
                    : data.familyName}
            </span>
            <h1 class="font-poppins text-2xl font-bold tracking-tight lg:text-3xl">
                {#if logged(_state.userState)}
                    Ahoj, {_state.userState.data.firstname}!
                {:else}
                    Vítej v FamilyAPP
                {/if}
            </h1>
        </div>
        <a
            href="/{data.familyUuid}/calendar"
            class="bg-accent/15 text-accent border-accent/30 hover:bg-accent/25 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors"
        >
            <Icon name="bi-calendar-plus" />
            <span>Otevřít kalendář</span>
        </a>
    </div>

    <!-- Quick Shortcuts -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
        {#each shortcuts.filter( (s) => (s.requiresHa ? haActive : true) ) as card (card.path)}
            <a
                href="/{data.familyUuid}{card.path}"
                class="bg-secondary/70 hover:bg-secondary group flex items-center gap-3.5 rounded-2xl border border-white/10 p-4 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-white/20"
            >
                <div
                    class={[
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xl transition-transform group-hover:scale-105',
                        card.color
                    ]}
                >
                    <Icon name={card.icon} />
                </div>
                <div class="min-w-0">
                    <p class="font-poppins truncate text-sm font-bold lg:text-base">
                        {card.name}
                    </p>
                    <p class="text-text/55 hidden truncate text-xs sm:block">
                        {card.desc}
                    </p>
                </div>
            </a>
        {/each}
    </div>

    <!-- Upcoming Events -->
    <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
            <Title class="text-xl lg:text-2xl">Blízké události</Title>
            <a
                href="/{data.familyUuid}/calendar"
                class="text-accent text-sm font-semibold transition-colors hover:text-red-400"
            >
                Všechny události →
            </a>
        </div>

        {#await data.recentEvents}
            <div
                class="bg-secondary/60 text-text/60 rounded-2xl border border-white/10 p-6 text-center text-sm font-medium"
            >
                Načítám události...
            </div>
        {:then events}
            {#if events.length == 0}
                <div
                    class="bg-secondary/60 flex flex-col items-center gap-2 rounded-2xl border border-white/10 p-8 text-center"
                >
                    <Icon name="bi-calendar-x" class="text-text/40 text-3xl" />
                    <p class="text-text/70 font-semibold">
                        Žádné nadcházející události v nejbližších 7 dnech
                    </p>
                </div>
            {:else}
                <div class="flex flex-col gap-3">
                    {#each events as event (event.id)}
                        {@const today = new Date()}
                        {@const tomorrow = new Date(today.getTime() + 86400000)}
                        {@const displayDate = eventIsInDay(today, event)
                            ? today
                            : eventIsInDay(tomorrow, event)
                              ? tomorrow
                              : event.from}
                        {@const range = getEventRange(event, displayDate)}
                        {@const diffDays = Math.round(
                            (new SvelteDate(event.from).setHours(0, 0, 0, 0) -
                                new SvelteDate().setHours(0, 0, 0, 0)) /
                                86400000
                        )}
                        {@const author = data.users.find(
                            (user) => user.id === event.user_id
                        )}
                        <div
                            class="bg-secondary/75 flex flex-col gap-2 rounded-2xl border border-white/10 p-4 shadow-xs transition-colors hover:border-white/20"
                        >
                            <div
                                class="flex flex-wrap items-center justify-between gap-2"
                            >
                                <p class="font-poppins text-base font-bold lg:text-lg">
                                    {getEventName(event, displayDate)}
                                </p>
                                <span
                                    class={[
                                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                                        eventIsInDay(today, event)
                                            ? 'border-accent/40 bg-accent/15 text-accent'
                                            : eventIsInDay(tomorrow, event)
                                              ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                                              : 'text-text/80 border-white/10 bg-white/5'
                                    ]}
                                >
                                    <Icon name="bi-clock-fill" />
                                    {#if eventIsInDay(today, event)}
                                        Dnes
                                    {:else if eventIsInDay(tomorrow, event)}
                                        Zítra
                                    {:else}
                                        za {locale(diffDays || 0, {
                                            one: 'den',
                                            two: 'dny',
                                            five: 'dní'
                                        })}
                                    {/if}: {range}
                                </span>
                            </div>
                            {#if event.description}
                                <p class="text-text/75 text-sm">{event.description}</p>
                            {/if}
                            {#if author}
                                <div
                                    class="text-text/55 flex items-center gap-1.5 text-xs"
                                >
                                    <Icon name="bi-person-fill" />
                                    <span>{formatUser(author)}</span>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        {/await}
    </div>
</section>
