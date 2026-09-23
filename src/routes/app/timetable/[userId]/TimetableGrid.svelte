<script lang="ts">
    import type { DailyRoutine, Route, RouteSegment } from '$/types/database';
    import { minToTime } from '$lib/timetableConfig';
    import type { Selectable } from 'kysely';
    import EntryModal from './EntryModal.svelte';
    import type { RouteSegmentLocal } from './RouteModal.svelte';
    import RoutineControls from './RoutineControls.svelte';

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

    let {
        timetable,
        routine,
        routes,
        segments,
        isMe,
        onAdd,
        onDelete,
        onUpdateRoutine,
        onUpdateRoute
    } = $props<{
        timetable: LocalEntry[];
        routine: Selectable<DailyRoutine>[];
        routes: Selectable<Route>[];
        segments: Selectable<RouteSegment>[];
        isMe: boolean;
        onAdd: (e: LocalEntry) => void;
        onDelete: (id: number) => void;
        onUpdateRoutine: (r: Partial<Selectable<DailyRoutine>>) => void;
        onUpdateRoute: (
            day: number,
            direction: 'morning' | 'evening',
            segs: RouteSegmentLocal[]
        ) => void;
    }>();

    function getRouteSegments(
        day: number,
        direction: 'morning' | 'evening'
    ): RouteSegmentLocal[] {
        const route = routes.find(
            (r: Selectable<Route>) => r.day === day && r.direction === direction
        );
        if (!route) return [];
        return segments
            .filter((s: Selectable<RouteSegment>) => s.route_id === route.id)
            .sort(
                (a: Selectable<RouteSegment>, b: Selectable<RouteSegment>) =>
                    a.position - b.position
            )
            .map((s: Selectable<RouteSegment>) => ({
                transport_type: s.transport_type as 'bus' | 'car',
                start_time: s.start_time != null ? minToTime(s.start_time) : '',
                end_time: s.end_time != null ? minToTime(s.end_time) : '',
                start_station: s.start_station ?? '',
                end_station: s.end_station ?? ''
            }));
    }

    // Configuration
    const days = ['Po', 'Út', 'St', 'Čt', 'Pá'];
    // Grid range from 7:00 to 20:00 (780 min total duration)
    const dayStartMin = 7 * 60; // 07:00
    const dayEndMin = 20 * 60; // 20:00
    const totalDuration = dayEndMin - dayStartMin;

    function getPositionStyles(start: number, end: number) {
        // Clamp values
        const s = Math.max(start, dayStartMin);
        const e = Math.min(end, dayEndMin);

        const top = ((s - dayStartMin) / totalDuration) * 100;
        const height = ((e - s) / totalDuration) * 100;

        return `top: ${top}%; height: ${height}%;`;
    }

    let showModal = $state(false);
    let editingEntry = $state<LocalEntry | undefined>(undefined);
    let selectedDay = $state(0);

    // Current time tracking
    let currentTimeMin = $state(0);
    let currentDayIndex = $state(0);

    function updateCurrentTime() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        currentTimeMin = hours * 60 + minutes;
        // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
        // Convert to our format where 0 = Monday (Po)
        const dayOfWeek = now.getDay();
        currentDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
    }

    // Update current time on mount and every minute
    $effect(() => {
        updateCurrentTime();
        const interval = setInterval(updateCurrentTime, 60000); // Update every minute
        return () => clearInterval(interval);
    });

    function startAdd(dayIndex: number) {
        if (!isMe) return;
        selectedDay = dayIndex;
        editingEntry = undefined;
        showModal = true;
    }

    function startEdit(entry: LocalEntry, e: MouseEvent) {
        if (!isMe) return;
        e.stopPropagation();
        editingEntry = entry;
        selectedDay = entry.day;
        showModal = true;
    }
</script>

<div class="flex flex-col gap-6">
    <!-- Header with Times -->
    <div class="border-primary bg-background overflow-x-auto rounded-lg border shadow-sm">
        <div class="grid min-w-[800px] grid-cols-[50px_repeat(5,1fr)]">
            <!-- Time Column Header -->
            <div
                class="bg-secondary border-primary text-text border-r border-b p-2 text-center text-base font-bold opacity-70"
            >
                Čas
            </div>
            {#each days as day, i (i)}
                <div
                    class="bg-secondary border-primary text-text group relative border-b p-2 text-center text-base font-bold"
                >
                    {day}
                    {#if isMe}
                        <button
                            class="hover:text-primary absolute top-1/2 right-1 -translate-y-1/2 text-white opacity-60 transition hover:opacity-100"
                            onclick={() => startAdd(i)}
                            title="Přidat předmět"
                            aria-label="Add class"
                        >
                            <i class="bi bi-plus-circle-fill text-lg"></i>
                        </button>
                    {/if}
                </div>
            {/each}

            <!-- Routine Row Top (Morning) -->
            <div
                class="bg-background border-primary text-text flex items-center justify-center border-r border-b p-1 text-center text-[10px] opacity-50"
            >
                <i class="bi bi-sunrise-fill text-yellow-500"></i>
            </div>
            {#each days as day, i (i)}
                <div class="border-primary bg-background border-b p-1">
                    <span class="hidden">{day}</span>
                    <RoutineControls
                        day={i}
                        type="morning"
                        data={routine.find((r: Selectable<DailyRoutine>) => r.day === i)}
                        {isMe}
                        onChange={onUpdateRoutine}
                        routeSegments={getRouteSegments(i, 'morning')}
                        onRouteChange={(segs) => onUpdateRoute(i, 'morning', segs)}
                    />
                </div>
            {/each}

            <!-- Main Timetable Grid -->
            <div class="border-primary bg-background relative h-[800px] border-r">
                <!-- Hour Markers -->
                {#each Array.from({ length: 14 }, (_, i) => i + 7) as hour (hour)}
                    <div
                        class="border-primary text-text absolute flex w-full justify-center border-t text-sm opacity-70"
                        style={getPositionStyles(hour * 60, hour * 60)}
                    >
                        <span class="bg-background -mt-2.5 px-1">{hour}:00</span>
                    </div>
                {/each}
            </div>

            {#each days as day, i (i)}
                <div
                    class="border-primary bg-background/50 hover:bg-secondary/20 relative h-[800px] border-r transition-colors"
                >
                    <span class="hidden">{day}</span>
                    <!-- Grid Background Lines -->
                    {#each Array.from({ length: 14 }, (_, i) => i + 7) as hour (hour)}
                        <div
                            class="border-primary/20 absolute w-full border-t"
                            style={getPositionStyles(hour * 60, hour * 60)}
                        ></div>
                    {/each}

                    <!-- Current Time Indicator -->
                    {#if i === currentDayIndex && currentTimeMin >= dayStartMin && currentTimeMin <= dayEndMin}
                        <div
                            class="absolute inset-x-0 z-20 flex items-center"
                            style={getPositionStyles(currentTimeMin, currentTimeMin)}
                        >
                            <div class="h-0.5 w-full bg-red-500 shadow-lg"></div>
                            <div
                                class="absolute -left-2 h-3 w-3 rounded-full border-2 border-white bg-red-500 shadow-lg"
                            ></div>
                        </div>
                    {/if}

                    <!-- Entries -->
                    {#each timetable.filter((e: LocalEntry) => e.day === i) as entry (entry.id ?? entry.start_min)}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div
                            class="absolute inset-x-1 z-10 flex cursor-pointer flex-col justify-center overflow-hidden rounded border p-1 text-sm shadow-sm transition hover:scale-[1.02] hover:shadow-md"
                            class:bg-red-900={entry.type === 'lecture'}
                            class:border-red-700={entry.type === 'lecture'}
                            class:text-red-100={entry.type === 'lecture'}
                            class:bg-blue-900={entry.type === 'practice'}
                            class:border-blue-700={entry.type === 'practice'}
                            class:text-blue-100={entry.type === 'practice'}
                            style={getPositionStyles(entry.start_min, entry.end_min)}
                            onclick={(e) => startEdit(entry, e)}
                        >
                            <div class="truncate font-bold">{entry.subject}</div>
                            <div class="truncate opacity-75">{entry.title}</div>
                            {#if entry.room}
                                <div
                                    class="absolute right-1 bottom-0.5 truncate text-xs opacity-60"
                                >
                                    <i class="bi bi-geo-alt-fill text-[10px]"></i>
                                    {entry.room}
                                </div>
                            {/if}
                            <div class="mt-0.5 text-xs opacity-60">
                                {minToTime(entry.start_min)} - {minToTime(entry.end_min)}
                            </div>
                        </div>
                    {/each}

                    {#if isMe && timetable.filter((e: LocalEntry) => e.day === i).length === 0}
                        <div
                            class="absolute inset-0 flex items-center justify-center opacity-0 transition duration-300 hover:opacity-100"
                        >
                            <button
                                class="rounded-full bg-blue-50 p-2 text-blue-400 hover:bg-blue-100"
                                onclick={() => startAdd(i)}
                                aria-label="Add class to empty day"
                            >
                                <i class="bi bi-plus-lg"></i>
                            </button>
                        </div>
                    {/if}
                </div>
            {/each}

            <!-- Routine Row Bottom (Evening/Home) -->
            <div
                class="bg-background border-primary text-text flex items-center justify-center border-t border-r p-1 text-center text-[10px] opacity-50"
            >
                <i class="bi bi-moon-stars-fill text-indigo-400"></i>
            </div>
            {#each days as day, i (i)}
                <div class="border-primary bg-background border-t p-1">
                    <span class="hidden">{day}</span>
                    <RoutineControls
                        day={i}
                        type="evening"
                        data={routine.find((r: Selectable<DailyRoutine>) => r.day === i)}
                        {isMe}
                        onChange={onUpdateRoutine}
                        routeSegments={getRouteSegments(i, 'evening')}
                        onRouteChange={(segs) => onUpdateRoute(i, 'evening', segs)}
                    />
                </div>
            {/each}
        </div>
    </div>
</div>

{#if showModal}
    <EntryModal
        day={selectedDay}
        entry={editingEntry}
        onSave={(e) => {
            onAdd(e);
            showModal = false;
        }}
        onDelete={(id) => {
            onDelete(id);
            showModal = false;
        }}
        onClose={() => (showModal = false)}
    />
{/if}
