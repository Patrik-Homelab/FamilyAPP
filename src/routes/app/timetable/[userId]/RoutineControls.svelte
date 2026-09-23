<script lang="ts">
    import type { DailyRoutine } from '$/types/database';
    import RouteModal, { type RouteSegmentLocal } from './RouteModal.svelte';

    let { day, type, data, isMe, onChange, routeSegments, onRouteChange } = $props<{
        day: number;
        type: 'morning' | 'evening';
        data: DailyRoutine | undefined;
        isMe: boolean;
        onChange: (r: Partial<DailyRoutine>) => void;
        routeSegments: RouteSegmentLocal[];
        onRouteChange: (segments: RouteSegmentLocal[]) => void;
    }>();

    // Local state for editing
    let isEditing = $state(false);
    let showRouteModal = $state(false);

    // Derived values
    const routine = $derived(
        data || {
            day,
            wake_time: null,
            transport_morning_type: null,
            transport_morning_time: null,
            transport_evening_type: null,
            transport_evening_time: null,
            home_arrival_time: null
        }
    );

    function formatTime(min: number | null | undefined) {
        if (!min && min !== 0) return '--:--';
        const h = Math.floor(min / 60);
        const m = min % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    function parseTime(str: string): number | null {
        if (!str) return null;
        const [h, m] = str.split(':').map(Number);
        return h * 60 + m;
    }

    // Temporary values for inputs
    let wakeTime = $state('');
    let transportTime = $state('');
    let transportType = $state<'bus' | 'car' | null>(null);
    let arrivalTime = $state('');

    function startEdit() {
        if (!isMe) return;
        isEditing = true;

        wakeTime = routine.wake_time ? formatTime(routine.wake_time) : '';

        if (type === 'morning') {
            transportType = routine.transport_morning_type as 'bus' | 'car' | null;
            transportTime = routine.transport_morning_time
                ? formatTime(routine.transport_morning_time)
                : '';
        } else {
            transportType = routine.transport_evening_type as 'bus' | 'car' | null;
            transportTime = routine.transport_evening_time
                ? formatTime(routine.transport_evening_time)
                : '';
            arrivalTime = routine.home_arrival_time
                ? formatTime(routine.home_arrival_time)
                : '';
        }
    }

    function save() {
        const update: Partial<DailyRoutine> = { day };
        // We use any here because mismatch between DB kysely types (ColumnType) and client types (number | null)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = update as any;

        if (type === 'morning') {
            u.wake_time = wakeTime ? parseTime(wakeTime) : null;
            u.transport_morning_type = transportType;
            u.transport_morning_time = transportTime ? parseTime(transportTime) : null;
        } else {
            u.transport_evening_type = transportType;
            u.transport_evening_time = transportTime ? parseTime(transportTime) : null;
            u.home_arrival_time = arrivalTime ? parseTime(arrivalTime) : null;
        }

        onChange(update);
        isEditing = false;
    }
</script>

<div class="flex min-h-[50px] flex-col items-center justify-center space-y-1 p-1 text-sm">
    {#if isEditing}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onclick={() => (isEditing = false)}
        >
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="bg-secondary border-primary w-full max-w-sm rounded-xl border p-5 text-sm shadow-2xl"
                onclick={(e) => e.stopPropagation()}
            >
                <h4 class="border-primary mb-3 border-b pb-2 text-base font-bold">
                    {type === 'morning' ? 'Ráno' : 'Odpoledne'}
                </h4>

                {#if type === 'morning'}
                    <div class="mb-2">
                        <!-- svelte-ignore a11y_label_has_associated_control -->
                        <label class="text-text mb-0.5 block opacity-70">Budíček</label>
                        <input
                            type="time"
                            bind:value={wakeTime}
                            class="border-primary bg-background text-text w-full rounded border p-1"
                        />
                    </div>
                {/if}

                <div class="mb-2">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label class="text-text mb-0.5 block opacity-70">Doprava</label>
                    <div class="mb-1 flex space-x-1">
                        <button
                            class="flex-1 rounded border p-1 {transportType === 'bus'
                                ? 'border-text bg-blue-600 text-white'
                                : 'bg-background border-primary text-text'}"
                            onclick={() => (transportType = 'bus')}
                            aria-label="Bus"
                        >
                            <i class="bi bi-bus-front"></i>
                        </button>
                        <button
                            class="flex-1 rounded border p-1 {transportType === 'car'
                                ? 'border-text bg-orange-600 text-white'
                                : 'bg-background border-primary text-text'}"
                            onclick={() => (transportType = 'car')}
                            aria-label="Car"
                        >
                            <i class="bi bi-car-front"></i>
                        </button>
                        <button
                            class="border-primary bg-background text-text rounded border p-1 opacity-70 hover:text-red-500"
                            onclick={() => (transportType = null)}
                            aria-label="Clear transport"
                        >
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                    <input
                        type="time"
                        bind:value={transportTime}
                        class="border-primary bg-background text-text w-full rounded border p-1"
                    />
                </div>

                {#if type === 'evening'}
                    <div class="mb-2">
                        <!-- svelte-ignore a11y_label_has_associated_control -->
                        <label class="text-text mb-0.5 block opacity-70"
                            >Příchod domů</label
                        >
                        <input
                            type="time"
                            bind:value={arrivalTime}
                            class="border-primary bg-background text-text w-full rounded border p-1"
                        />
                    </div>
                {/if}

                <div class="mt-2 flex justify-end space-x-2">
                    <button
                        onclick={() => (isEditing = false)}
                        class="text-text opacity-70 hover:underline">Zrušit</button
                    >
                    <button
                        onclick={save}
                        class="bg-accent hover:bg-opacity-90 rounded px-2 py-1 text-white"
                        >Uložit</button
                    >
                </div>
            </div>
        </div>
    {/if}

    <!-- View Mode -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="hover:bg-secondary text-text flex h-full w-full cursor-pointer flex-col items-center justify-center rounded p-1 transition"
        onclick={startEdit}
    >
        {#if type === 'morning'}
            {#if routine.wake_time}
                <div class="flex items-center space-x-1" title="Budíček">
                    <i class="bi bi-alarm text-text opacity-70"></i>
                    <span>{formatTime(routine.wake_time)}</span>
                </div>
            {/if}
            {#if routine.transport_morning_time}
                <div
                    class="flex items-center space-x-1"
                    title={routine.transport_morning_type === 'bus' ? 'Autobus' : 'Auto'}
                >
                    <i
                        class="bi {routine.transport_morning_type === 'bus'
                            ? 'bi-bus-front text-blue-400'
                            : 'bi-car-front text-orange-400'} text-base"
                    ></i>
                    <span>{formatTime(routine.transport_morning_time)}</span>
                </div>
            {/if}
        {:else}
            {#if routine.transport_evening_time}
                <div
                    class="flex items-center space-x-1"
                    title={routine.transport_evening_type === 'bus' ? 'Autobus' : 'Auto'}
                >
                    <i
                        class="bi {routine.transport_evening_type === 'bus'
                            ? 'bi-bus-front text-blue-400'
                            : 'bi-car-front text-orange-400'} text-base"
                    ></i>
                    <span>{formatTime(routine.transport_evening_time)}</span>
                </div>
            {/if}
            {#if routine.home_arrival_time}
                <div class="flex items-center space-x-1" title="Příchod domů">
                    <i class="bi bi-house-door text-green-500"></i>
                    <span>{formatTime(routine.home_arrival_time)}</span>
                </div>
            {/if}
        {/if}

        {#if isMe && !routine.wake_time && !routine.transport_morning_time && !routine.transport_evening_time && !routine.home_arrival_time}
            <span class="text-text text-lg opacity-30">+</span>
        {/if}
    </div>

    <!-- Route segments summary -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="border-primary text-text flex w-full cursor-pointer flex-wrap items-center justify-center gap-1 border-t p-1 text-xs transition {isMe
            ? 'hover:bg-secondary'
            : ''}"
        onclick={isMe ? () => (showRouteModal = true) : undefined}
        title={isMe ? 'Plánovat trasu' : undefined}
    >
        {#if routeSegments.length > 0}
            {#each routeSegments as seg, i (i)}
                {#if i > 0}
                    <i class="bi bi-arrow-right opacity-40"></i>
                {/if}
                <span
                    class="rounded px-1 py-0.5 {seg.transport_type === 'bus'
                        ? 'bg-blue-900/40 text-blue-300'
                        : 'bg-orange-900/40 text-orange-300'}"
                    title={seg.transport_type === 'bus'
                        ? `${seg.start_station || '?'} → ${seg.end_station || '?'}`
                        : `${seg.start_time || '?'} – ${seg.end_time || '?'}`}
                >
                    <i
                        class="bi {seg.transport_type === 'bus'
                            ? 'bi-bus-front'
                            : 'bi-car-front'}"
                    ></i>
                </span>
            {/each}
        {:else if isMe}
            <span class="opacity-30"><i class="bi bi-map"></i> trasa</span>
        {/if}
    </div>
</div>

{#if showRouteModal}
    <RouteModal
        {day}
        direction={type}
        segments={routeSegments}
        onSave={(segs) => {
            onRouteChange(segs);
            showRouteModal = false;
        }}
        onClose={() => (showRouteModal = false)}
    />
{/if}
