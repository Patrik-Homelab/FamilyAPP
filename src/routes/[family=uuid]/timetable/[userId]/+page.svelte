<script lang="ts">
    import type { DailyRoutine } from '$/types/database';
    import { page } from '$app/stores';
    import { API } from '$lib/api';
    import { SwalAlert } from '$lib/functions';
    import type { Selectable } from 'kysely';
    import TimetableGrid from './TimetableGrid.svelte';

    // Type definition since database.ts uses Generated<T> which is confusing in frontend
    type LocalEntry = {
        id?: number;
        day: number;
        start_min: number;
        end_min: number;
        title: string;
        type: 'lecture' | 'practice';
        subject: string;
        room?: string | null;
    };

    let loading = $state(true);
    let timetable = $state<LocalEntry[]>([]);
    let routine = $state<Selectable<DailyRoutine>[]>([]);
    let isMe = $state(false);

    // Using page stores properly in Svelte 5 (or just use $page with stores import)
    // But page is a store, so get(page).params or use $page in template, but here we need it in script
    // We can use $effect or just read it once if it doesn't change
    const userId = Number($page.params.userId);

    async function loadData() {
        loading = true;
        const res = await API.timetable.POST({ userId });
        if (res.status) {
            // @ts-expect-error - Kysely types mismatch with strict client types sometimes
            timetable = res.data.timetable;
            routine = res.data.routine;
            isMe = res.data.isMe;
        }
        loading = false;
    }

    $effect(() => {
        loadData();
    });

    async function handleAddEntry(entry: LocalEntry) {
        const res = await API.timetable.PUT({
            ...entry,
            room: entry.room || undefined
        });

        if (res.status) {
            await loadData();
            SwalAlert({ icon: 'success', title: 'Uloženo' });
        } else {
            SwalAlert({ icon: 'error', title: 'Chyba', text: res.message });
        }
    }

    async function handleDeleteEntry(id: number) {
        const res = await API.timetable.DELETE({ id });
        if (res.status) {
            await loadData();
            SwalAlert({ icon: 'success', title: 'Smazáno' });
        } else {
            SwalAlert({ icon: 'error', title: 'Chyba', text: res.message });
        }
    }

    async function handleUpdateRoutine(r: Partial<Selectable<DailyRoutine>>) {
        if (r.day === undefined) return;
        const res = await API.timetable.PATCH({
            day: r.day,
            wake_time: r.wake_time,
            transport_morning_type: r.transport_morning_type as
                | 'bus'
                | 'car'
                | null
                | undefined,
            transport_morning_time: r.transport_morning_time,
            transport_evening_type: r.transport_evening_type as
                | 'bus'
                | 'car'
                | null
                | undefined,
            transport_evening_time: r.transport_evening_time,
            home_arrival_time: r.home_arrival_time
        });

        if (res.status) {
            await loadData(); // Reload to confirm state
        }
    }
</script>

<div class="bg-background h-full min-h-screen w-full p-2 md:p-4">
    {#if loading}
        <div class="flex h-64 items-center justify-center">
            <div
                class="border-primary h-12 w-12 animate-spin rounded-full border-b-2"
            ></div>
        </div>
    {:else}
        <TimetableGrid
            {timetable}
            {routine}
            {isMe}
            onAdd={handleAddEntry}
            onDelete={handleDeleteEntry}
            onUpdateRoutine={handleUpdateRoutine}
        />
    {/if}
</div>
