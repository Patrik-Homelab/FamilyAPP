<script lang="ts">
    import Title from '$/components/headers/Title.svelte';
    import Icon from '$/components/Icon.svelte';
    import { eventIsInDay, getEventName, getEventRange } from '$/lib/calendarUtils';
    import { formatUser, locale } from '$/lib/functions';
    import { SvelteDate } from 'svelte/reactivity';
    import type { PageProps } from './$types';

    const { data }: PageProps = $props();
</script>

<section class="flex flex-1 flex-col items-center gap-2">
    <Title>Blízké události</Title>
    {#await data.recentEvents}
        <p class="text-center font-bold text-gray-500">Načítám události...</p>
    {:then events}
        {#if events.length == 0}
            <p class="text-center font-bold text-gray-500">
                Nejsou žádné blízké události :(
            </p>
        {:else}
            <div
                class="divide-primary border-primary flex w-[80%] flex-col gap-2 divide-y-2 rounded-md border-2 p-2"
            >
                {#each events as event (event.id)}
                    {@const today = new Date()}
                    {@const tomorrow = new Date(today.getTime() + 86400000)}
                    {@const displayDate = eventIsInDay(today, event)
                        ? today
                        : eventIsInDay(tomorrow, event)
                          ? tomorrow
                          : event.from}
                    {@const range = getEventRange(event, displayDate)}
                    <div class="flex flex-col gap-2">
                        <div class="flex justify-between">
                            <p class="font-bold">{getEventName(event, displayDate)}</p>
                            <p>
                                {#if eventIsInDay(today, event)}
                                    Dnes
                                {:else if eventIsInDay(tomorrow, event)}
                                    Zítra
                                {:else}
                                    za {locale(
                                        (event.from.setHours(0, 0, 0, 0) -
                                            new SvelteDate().setHours(0, 0, 0, 0)) /
                                            86400000 || 0,
                                        {
                                            one: 'den',
                                            two: 'dny',
                                            five: 'dní'
                                        }
                                    )}
                                {/if}: {range}
                            </p>
                        </div>
                        <p>{event.description}</p>

                        <p>
                            <Icon name="bi-person-fill" />
                            {formatUser(
                                data.users.find((user) => user.id === event.user_id)!
                            )}
                        </p>
                    </div>
                {/each}
            </div>
        {/if}
    {/await}
</section>
