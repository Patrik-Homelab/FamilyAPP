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
    <div class="flex flex-1 flex-col items-center gap-2">
        <div class="flex w-full items-center gap-1 px-4 text-4xl">
            <Icon
                onclick={showAddingEvent}
                class="mr-auto text-xl"
                name="bi-calendar-plus"
            />
            <Icon onclick={monthBefore} name="bi-chevron-left" />
            <MonthSelector class="text-2xl" bind:value={month} />
            <select class="text-2xl" bind:value={year}>
                <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
                {#each new Array(10) as _, i (i)}
                    {@const y = year - 5 + i}
                    <option value={y}>{y}</option>
                {/each}
            </select>

            <Icon onclick={monthAfter} name="bi-chevron-right" />
            <Icon
                onclick={() => selectedDay.setTime(Date.now())}
                class="ml-auto text-xl"
                name="bi-calendar-event"
            />
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
                    <Tr>
                        {#each week as day (day.date.toString())}
                            {@const hasEvent = events?.some((event) => {
                                return eventIsInDay(day.date, event);
                            })}
                            <Td
                                onclick={() => {
                                    selectedDay.setTime(day.date.getTime());
                                }}
                                class={{
                                    'text-gray-500': !day.isCurrentMonth,
                                    'font-bold text-sky-500': day.isToday,
                                    'cursor-pointer': true,
                                    'bg-sky-500 text-white':
                                        day.date.toDateString() ===
                                        selectedDay.toDateString(),
                                    'text-yellow-500': hasEvent
                                }}
                            >
                                {day.date.getDate()}
                            </Td>
                        {/each}
                    </Tr>
                {/each}
            </tbody>
        </Table>
        <Title>{intl.format(selectedDay)}</Title>
        <div class="flex w-full flex-col gap-2 divide-y-2 divide-white px-4">
            {#if events}
                {@const eventsToday = events.filter((event) => {
                    return eventIsInDay(selectedDay, event);
                })}
                {#if eventsToday.length == 0}
                    <p class="text-center text-gray-500">
                        V tento den nejsou žádné údalosti
                    </p>
                {:else}
                    {#each sortEvents(eventsToday) as event (selectedDay.toString() + event.id)}
                        <div class="flex flex-col gap-1">
                            <div class="flex justify-between">
                                <p class="font-bold">
                                    {getEventName(event, selectedDay)}
                                </p>
                                <p>
                                    <Icon name="bi-clock-fill" />

                                    {getEventRange(event, selectedDay)}
                                </p>
                            </div>
                            <p>{event.description}</p>
                            <div class="flex justify-between">
                                <p>
                                    <Icon name="bi-person-fill" />
                                    {formatUser(
                                        data.users.find(
                                            (user) => user.id === event.user_id
                                        )!
                                    )}
                                </p>
                                <div class="flex gap-2">
                                    {#if event.user_id === _state.userState.data.id}
                                        <Icon
                                            onclick={() => removeEvent(event.id)}
                                            name="bi-trash-fill"
                                            class="text-red-500"
                                        />
                                    {/if}
                                    <a href={makeGoogleCalendarUrl(event)} target="_blank"
                                        ><Icon name="bi-share-fill" /></a
                                    >
                                </div>
                            </div>
                        </div>
                    {/each}
                {/if}
            {:else}
                <p class="text-center text-gray-500">Načítání...</p>
            {/if}
        </div>
    </div>
{/if}

{#if addingEvent}
    <div
        bind:this={addOverlay}
        class="absolute top-0 left-0 z-20 flex h-screen w-full items-center justify-center bg-black/50"
    >
        <ClickOutside
            clickoutside={() => (addingEvent = false)}
            class="border-primary bg-secondary flex flex-col gap-2 rounded-md border-2 p-4"
        >
            <Title>Přidání události</Title>
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
                    bind:value={eventData.description.value}
                    invalid={eventData.description.error}
                />
            </Entry>
            <Entry id="fullDay" label="Celodenní událost?">
                <Slider
                    id="fullDay"
                    bind:value={eventData.fullDay.value}
                    invalid={eventData.fullDay.error}
                />
            </Entry>
            <Entry id="notification" label="Odeslat oznámení o přidání?">
                <Slider
                    id="notification"
                    bind:value={eventData.notification.value}
                    invalid={eventData.notification.error}
                />
            </Entry>
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
            <Button onclick={addEvent}>Přidat</Button>
        </ClickOutside>
    </div>
{/if}
