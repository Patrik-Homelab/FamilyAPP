<script lang="ts">
    import ClickOutside from '$/components/clickOutside.svelte';
    import { Button, Entry, Input, Slider, TextArea } from '$/components/form';
    import Title from '$/components/headers/Title.svelte';
    import Icon from '$/components/Icon.svelte';
    import { Table, Td, Th, Tr } from '$/components/table';
    import { API } from '$/lib/api';
    import {
        eventIsInDay,
        getEventName,
        getEventRange,
        type Event
    } from '$/lib/calendarUtils';
    import { extractError, matchError } from '$/lib/errors';
    import { Calendar, formatUser, SwalAlert, toLocalDateString } from '$/lib/functions';
    import { getState } from '$/lib/state.svelte';
    import { browser } from '$app/environment';
    import { onMount, untrack } from 'svelte';
    import { SvelteDate, SvelteMap, SvelteURLSearchParams } from 'svelte/reactivity';

    import MonthSelector from '../../../components/form/MonthSelector.svelte';
    import type { PageProps } from './$types';

    const { data }: PageProps = $props();

    const calendar = new Calendar();

    const days = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
    const shortDays = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

    let isMobile = $state(browser ? window.innerWidth < 1024 : true);
    const handleResize = () => {
        isMobile = window.innerWidth < 1024;
    };

    let selectedDay = new SvelteDate(calendar.today);

    const monthBefore = () => {
        selectedDay.setMonth(selectedDay.getMonth() - 1);
    };

    const monthAfter = () => {
        selectedDay.setMonth(selectedDay.getMonth() + 1);
    };

    let addOverlay = $state() as HTMLDivElement;

    const handleKeys = (ev: KeyboardEvent) => {
        if (ev.target) {
            //If in adding overlay, don't handle keys
            //this was problem, when user used arrows on pc
            //in input and it moved calendar
            if (addOverlay && addOverlay.contains(ev.target as Node)) return;
        }

        if (ev.key === 'ArrowLeft') {
            monthBefore();
        } else if (ev.key === 'ArrowRight') {
            monthAfter();
        }
    };

    onMount(() => {
        window.addEventListener('resize', handleResize);
        window.addEventListener('keydown', handleKeys);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeys);
        };
    });

    let events = $state<Event[]>();

    const cachedEvents = new SvelteMap<string, Event[]>();
    const eventPagesMap = new SvelteMap<number, Set<string>>();

    const resolveMonth = async () => {
        const firstDay = calendar.getFirstDayOfCalendar(new Date(selectedDay));
        const lastDay = calendar.getLastDayOfCalendar(new Date(selectedDay));

        const cacheKey = firstDay.toISOString() + ' ' + lastDay.toISOString();

        if (cachedEvents.has(cacheKey)) {
            events = cachedEvents.get(cacheKey);
            return;
        }

        const response = await API.calendar.POST({
            from: firstDay,
            to: lastDay
        });

        if (!response.status) {
            SwalAlert({
                icon: 'error',
                title: response.message
            });
            return;
        }

        events = response.data.map(
            (item) =>
                ({
                    ...item,
                    from: new Date(item.from),
                    to: new Date(item.to)
                }) as unknown as Event
        );

        cachedEvents.set(cacheKey, events);
        for (const event of events) {
            if (!eventPagesMap.has(event.id)) {
                eventPagesMap.set(event.id, new Set());
            }

            eventPagesMap.get(event.id)!.add(cacheKey);
        }
    };

    let calendarEl = $state() as HTMLTableElement;

    type Point = {
        x: number;
        y: number;
    };

    let dragStart = $state<Point>();

    const startDrag = (ev: MouseEvent | TouchEvent) => {
        if ('clientX' in ev) {
            dragStart = {
                x: ev.clientX,
                y: ev.clientY
            };
            return;
        }

        dragStart = {
            x: ev.touches[0].clientX,
            y: ev.touches[0].clientY
        };
    };

    const stopDrag = (ev: MouseEvent | TouchEvent) => {
        if (!dragStart) return;

        let end =
            'clientX' in ev
                ? {
                      x: ev.clientX,
                      y: ev.clientY
                  }
                : {
                      x: ev.changedTouches[0].clientX,
                      y: ev.changedTouches[0].clientY
                  };

        let deltaX = end.x - dragStart.x;

        const minSwipe = window.innerWidth / 4;

        if (deltaX > minSwipe) {
            monthBefore();
        } else if (deltaX < -minSwipe) {
            monthAfter();
        }

        dragStart = undefined;
    };

    onMount(() => {
        resolveMonth();

        if (!calendarEl) return;

        calendarEl.addEventListener('mousedown', startDrag);
        calendarEl.addEventListener('mouseup', stopDrag);
        calendarEl.addEventListener('touchstart', startDrag);
        calendarEl.addEventListener('touchend', stopDrag);

        return () => {
            if (!calendarEl) return;

            calendarEl.removeEventListener('mousedown', startDrag);
            calendarEl.removeEventListener('mouseup', stopDrag);
            calendarEl.removeEventListener('touchstart', startDrag);
            calendarEl.removeEventListener('touchend', stopDrag);
        };
    });

    const intl = Intl.DateTimeFormat('cs-CZ', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        weekday: 'long'
    });

    let month = $state(new Date().getMonth());

    $effect(() => {
        selectedDay.setMonth(month);
        untrack(() => resolveMonth());
    });

    let year = $state(new Date().getFullYear());

    $effect(() => {
        selectedDay.setFullYear(year);
        untrack(() => resolveMonth());
    });

    $effect(() => {
        if (selectedDay.getMonth() !== month) {
            month = selectedDay.getMonth();
        }

        if (selectedDay.getFullYear() !== year) {
            year = selectedDay.getFullYear();
        }
    });

    const sortEvents = (events: Event[]) => {
        events.sort((a, b) => {
            if (a.full_day.data[0] == 1) return -1;
            if (b.full_day.data[0] == 1) return 1;

            //if starts some days before and ends some days after, it should be considered fullday for this current day
            if (
                a.from.getDate() < selectedDay.getDate() &&
                a.to.getDate() > selectedDay.getDate()
            )
                return -1;

            return a.from.getTime() - b.from.getTime();
        });

        return events;
    };

    const dateToGoogleCalendar = (date: Date) => {
        return date.toISOString().replace(/-|:|\.\d+/g, '');
    };

    const makeGoogleCalendarUrl = (event: Event) => {
        let BASE_URL = 'https://calendar.google.com/calendar/render';
        const params = new SvelteURLSearchParams({
            action: 'TEMPLATE',
            text: event.name,
            details: event.description ?? ''
        });

        if (event.full_day.data[0] == 1) {
            //end day is exclusive, so we need to add 1 day to
            const to = new SvelteDate(event.to);
            to.setDate(to.getDate() + 1);

            params.append(
                'dates',
                `${dateToGoogleCalendar(event.from).split('T')[0]}/${dateToGoogleCalendar(to).split('T')[0]}`
            );
        } else {
            params.append(
                'dates',
                `${dateToGoogleCalendar(event.from)}/${dateToGoogleCalendar(event.to)}`
            );
        }

        return `${BASE_URL}?${params.toString()}`;
    };

    let addingEvent = $state(false);

    const fields = [
        'name',
        'description',
        'from',
        'to',
        'fullDay',
        'notification'
    ] as const;
    const defaultValues = [
        '',
        '',
        toLocalDateString(new Date()),
        toLocalDateString(new Date()),
        false,
        true
    ] as const;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Indices<T extends readonly any[]> = Exclude<keyof T, keyof []>;

    type DataType = {
        [Index in Indices<typeof fields> as (typeof fields)[Index]]: {
            value: (typeof defaultValues)[Index];
            error?: string;
        };
    };
    const eventData = $state(
        Object.fromEntries(
            fields.map((item, idx) => [item, { value: defaultValues[idx] }])
        ) as DataType
    );

    const addEvent = async () => {
        Object.values(eventData).forEach((item) => (item.error = undefined));

        if (!eventData.name.value) {
            eventData.name.error = 'Vyplň prosím název';
        }

        const from = new Date(eventData.from.value);
        const to = new Date(eventData.to.value);

        if (from.toDateString() === 'Invalid Date') {
            eventData.from.error = 'Vyplň prosím platný datum';
        }

        if (to.toDateString() === 'Invalid Date') {
            eventData.to.error = 'Vyplň prosím platný datum';
        }

        if (from.getTime() > to.getTime()) {
            eventData.to.error = 'Konec události nemůže být před začátkem';
        }

        if (Object.values(eventData).some((item) => item.error !== undefined)) {
            return;
        }

        const response = await API.calendar.PUT({
            name: eventData.name.value.trim(),
            description: eventData.description.value.trim() || undefined,
            from,
            to,
            fullDay: eventData.fullDay.value,
            notification: eventData.notification.value
        });

        if (!response.status) {
            if (matchError(response.message, 'calendar.date')) {
                eventData.to.error = extractError(response.message);
                return;
            }

            SwalAlert({
                icon: 'error',
                title: response.message
            });
            return;
        }

        SwalAlert({
            icon: 'success',
            title: 'Událost byla úspěšně přidána'
        });

        addingEvent = false;

        const eventBetween = (from: Date, to: Date) => {
            const eventFrom = new Date(eventData.from.value);
            const eventTo = new Date(eventData.to.value);

            return (
                (eventFrom >= from && eventFrom <= to) ||
                (eventTo >= from && eventTo <= to)
            );
        };

        //remove from cache
        for (const [pageKey] of cachedEvents) {
            const [firstDay, lastDay] = pageKey.split(' ');

            if (eventBetween(new Date(firstDay), new Date(lastDay))) {
                cachedEvents.delete(pageKey);
            }
        }

        resolveMonth();

        //reset
        let i = 0;
        for (const key of Object.keys(eventData)) {
            eventData[key as keyof typeof eventData].value = defaultValues[i];
            ++i;
        }
    };

    $effect(() => {
        if (eventData.fullDay.value) {
            untrack(() => {
                eventData.from.value = eventData.from.value.split('T')[0];
                eventData.to.value = eventData.to.value.split('T')[0];
            });
        } else {
            untrack(() => {
                if (!eventData.from.value.includes('T')) {
                    eventData.from.value = eventData.from.value + 'T00:00';
                    eventData.to.value = eventData.to.value + 'T00:00';
                }
            });
        }
    });

    $effect(() => {
        if (
            new Date(eventData.from.value).getTime() >
            untrack(() => new Date(eventData.to.value).getTime())
        ) {
            untrack(() => {
                eventData.to.value = eventData.from.value;
            });
        }
    });

    const removeEvent = async (eventId: number) => {
        const result = await SwalAlert({
            title: 'Opravdu chceš smazat tuto událost',
            toast: false,
            position: 'center',
            timer: 0,
            showCancelButton: true,
            cancelButtonText: 'Zrušit',
            showConfirmButton: true,
            confirmButtonText: 'Smazat'
        });

        if (!result.isConfirmed) return;

        const response = await API.calendar.DELETE(eventId);
        if (!response.status) {
            if (matchError(response.message, 'calendar.delete')) {
                SwalAlert({
                    icon: 'error',
                    title: extractError(response.message)
                });
                return;
            }

            SwalAlert({
                icon: 'error',
                title: response.message
            });
            return;
        }

        SwalAlert({
            icon: 'success',
            title: 'Událost byla úspěšně smazána'
        });

        //remove from cache
        for (const page of eventPagesMap.get(eventId)!) {
            cachedEvents.delete(page);
        }

        eventPagesMap.delete(eventId);

        resolveMonth();
    };

    const showAddingEvent = () => {
        addingEvent = true;
        eventData.from.value = toLocalDateString(selectedDay);
    };

    const _state = getState();
</script>

{#if _state.userState.logged}
    <div class="flex flex-1 flex-col gap-5 pb-6">
        <!-- Calendar Toolbar -->
        <div
            class="bg-secondary/80 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-3 shadow-sm"
        >
            <button
                type="button"
                onclick={showAddingEvent}
                class="bg-accent inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white shadow-xs transition hover:brightness-110"
            >
                <Icon name="bi-calendar-plus" />
                <span>Přidat událost</span>
            </button>

            <div class="flex items-center gap-2">
                <button
                    type="button"
                    onclick={monthBefore}
                    class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/10 transition-colors hover:bg-white/10"
                    aria-label="Předchozí měsíc"
                >
                    <Icon name="bi-chevron-left" />
                </button>
                <MonthSelector
                    class="text-sm font-semibold sm:text-base"
                    bind:value={month}
                />
                <select
                    class="bg-secondary text-text focus:border-accent cursor-pointer rounded-xl border border-white/15 px-3 py-1.5 text-sm font-semibold outline-hidden sm:text-base"
                    bind:value={year}
                >
                    <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
                    {#each new Array(10) as _, i (i)}
                        {@const y = year - 5 + i}
                        <option value={y}>{y}</option>
                    {/each}
                </select>
                <button
                    type="button"
                    onclick={monthAfter}
                    class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/10 transition-colors hover:bg-white/10"
                    aria-label="Další měsíc"
                >
                    <Icon name="bi-chevron-right" />
                </button>
            </div>

            <button
                type="button"
                onclick={() => selectedDay.setTime(Date.now())}
                class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10"
            >
                <Icon name="bi-calendar-event" />
                <span>Dnes</span>
            </button>
        </div>

        <Table bind:self={calendarEl}>
            <thead>
                <Tr>
                    {#each isMobile ? shortDays : days as day (day)}
                        <Th>{day}</Th>
                    {/each}
                </Tr>
            </thead>
            <tbody class="text-center align-middle select-none">
                {#each calendar.monthWeekIterator(selectedDay) as week (week)}
                    <Tr class="hover:bg-transparent">
                        {#each week as day (day.date.toString())}
                            {@const hasEvent = events?.some((event) => {
                                return eventIsInDay(day.date, event);
                            })}
                            {@const isSelected =
                                day.date.toDateString() === selectedDay.toDateString()}
                            <Td
                                onclick={() => {
                                    selectedDay.setTime(day.date.getTime());
                                }}
                                class={[
                                    'relative cursor-pointer p-1.5 text-center transition-colors sm:p-2.5',
                                    !day.isCurrentMonth && 'text-text/35',
                                    isSelected
                                        ? 'bg-accent/25 ring-accent/70 font-bold text-white ring-2 ring-inset'
                                        : 'hover:bg-white/[0.06]',
                                    day.isToday &&
                                        !isSelected &&
                                        'font-bold text-sky-400 ring-1 ring-sky-400/50 ring-inset'
                                ]}
                            >
                                <div
                                    class="flex flex-col items-center justify-center gap-0.5"
                                >
                                    <span>{day.date.getDate()}</span>
                                    <span
                                        class={[
                                            'h-1.5 w-1.5 rounded-full',
                                            hasEvent ? 'bg-amber-400' : 'bg-transparent'
                                        ]}
                                    ></span>
                                </div>
                            </Td>
                        {/each}
                    </Tr>
                {/each}
            </tbody>
        </Table>

        <div class="flex flex-col gap-3">
            <Title class="text-xl lg:text-2xl">{intl.format(selectedDay)}</Title>
            {#if events}
                {@const eventsToday = events.filter((event) => {
                    return eventIsInDay(selectedDay, event);
                })}
                {#if eventsToday.length == 0}
                    <div
                        class="bg-secondary/60 text-text/60 rounded-2xl border border-white/10 p-6 text-center text-sm"
                    >
                        V tento den nejsou žádné události
                    </div>
                {:else}
                    <div class="flex flex-col gap-2.5">
                        {#each sortEvents(eventsToday) as event (selectedDay.toString() + event.id)}
                            <div
                                class="bg-secondary/75 flex flex-col gap-2 rounded-2xl border border-white/10 p-4 shadow-xs"
                            >
                                <div
                                    class="flex flex-wrap items-center justify-between gap-2"
                                >
                                    <p class="font-poppins text-base font-bold">
                                        {getEventName(event, selectedDay)}
                                    </p>
                                    <span
                                        class="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-medium"
                                    >
                                        <Icon name="bi-clock-fill" />
                                        {getEventRange(event, selectedDay)}
                                    </span>
                                </div>
                                {#if event.description}
                                    <p class="text-text/75 text-sm">
                                        {event.description}
                                    </p>
                                {/if}
                                <div class="flex items-center justify-between gap-2 pt-1">
                                    <span
                                        class="text-text/60 flex items-center gap-1.5 text-xs"
                                    >
                                        <Icon name="bi-person-fill" />
                                        {formatUser(
                                            data.users.find(
                                                (user) => user.id === event.user_id
                                            )!
                                        )}
                                    </span>
                                    <div class="flex items-center gap-2">
                                        {#if event.user_id === _state.userState.data.id}
                                            <button
                                                type="button"
                                                onclick={() => removeEvent(event.id)}
                                                class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-500/15"
                                                title="Smazat událost"
                                            >
                                                <Icon name="bi-trash-fill" />
                                            </button>
                                        {/if}
                                        <a
                                            href={makeGoogleCalendarUrl(event)}
                                            target="_blank"
                                            class="text-text/75 hover:text-text flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
                                            title="Přidat do Google Kalendáře"
                                        >
                                            <Icon name="bi-share-fill" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            {:else}
                <p class="text-text/60 text-center text-sm">Načítání...</p>
            {/if}
        </div>
    </div>
{/if}

{#if addingEvent}
    <div
        bind:this={addOverlay}
        class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm"
    >
        <ClickOutside
            clickoutside={() => (addingEvent = false)}
            class="bg-secondary flex w-full max-w-lg flex-col gap-3 rounded-2xl border border-white/15 p-6 shadow-2xl"
        >
            <div class="flex items-center justify-between border-b border-white/10 pb-3">
                <Title class="text-xl lg:text-2xl">Přidání události</Title>
                <button
                    type="button"
                    onclick={() => (addingEvent = false)}
                    class="text-text/60 hover:text-text flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg hover:bg-white/10"
                    aria-label="Zavřít"
                >
                    <Icon name="bi-x-lg" />
                </button>
            </div>
            <Entry id="name" label="Název" error={eventData.name.error}>
                <Input
                    id="name"
                    bind:value={eventData.name.value}
                    invalid={eventData.name.error}
                />
            </Entry>
            <Entry id="desc" label="Popis" error={eventData.description.error}>
                <TextArea
                    id="desc"
                    rows={2}
                    bind:value={eventData.description.value}
                    invalid={eventData.description.error}
                />
            </Entry>
            <div
                class="bg-background/40 grid grid-cols-1 gap-3 rounded-xl border border-white/10 p-3 sm:grid-cols-2"
            >
                <Entry id="fullDay" label="Celodenní událost" row={true} small={true}>
                    <Slider
                        id="fullDay"
                        bind:value={eventData.fullDay.value}
                        invalid={eventData.fullDay.error}
                    />
                </Entry>
                <Entry id="notification" label="Odeslat oznámení" row={true} small={true}>
                    <Slider
                        id="notification"
                        bind:value={eventData.notification.value}
                        invalid={eventData.notification.error}
                    />
                </Entry>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Entry id="from" label="Začátek" error={eventData.from.error}>
                    <Input
                        id="from"
                        type={eventData.fullDay.value ? 'date' : 'datetime-local'}
                        bind:value={eventData.from.value}
                        invalid={eventData.from.error}
                    />
                </Entry>
                <Entry id="to" label="Konec" error={eventData.to.error}>
                    <Input
                        id="to"
                        type={eventData.fullDay.value ? 'date' : 'datetime-local'}
                        bind:value={eventData.to.value}
                        invalid={eventData.to.error}
                    />
                </Entry>
            </div>
            <Button onclick={addEvent} class="mt-2">Přidat událost</Button>
        </ClickOutside>
    </div>
{/if}
