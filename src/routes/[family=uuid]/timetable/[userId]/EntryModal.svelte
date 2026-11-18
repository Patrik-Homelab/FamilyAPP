<script lang="ts">
    import { TIME_BLOCKS, minToTime, timeToMin } from '$lib/timetableConfig';

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

    let { day, entry, onSave, onDelete, onClose } = $props<{
        day: number;
        entry?: LocalEntry;
        onSave: (e: LocalEntry) => void;
        onDelete: (id: number) => void;
        onClose: () => void;
    }>();

    let subject = $state(entry?.subject ?? '');
    let title = $state(entry?.title ?? '');
    let type = $state<'lecture' | 'practice'>(entry?.type ?? 'lecture');
    let room = $state(entry?.room ?? '');

    // Default to the first block (8:00) if no entry
    let startTime = $state(minToTime(entry?.start_min ?? 8 * 60));
    let endTime = $state(minToTime(entry?.end_min ?? 8 * 60 + 45));

    function setBlock(start: string, end: string) {
        startTime = start;
        endTime = end;
    }

    function save() {
        if (!subject || !title || !startTime || !endTime) return;

        onSave({
            id: entry?.id,
            day: entry?.day ?? day, // Keep original day if editing, else use prop
            start_min: timeToMin(startTime),
            end_min: timeToMin(endTime),
            subject,
            title,
            type,
            room
        });
    }
</script>

<div
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
>
    <div
        class="bg-background border-primary w-full max-w-lg overflow-hidden rounded-xl border shadow-2xl"
    >
        <div
            class="bg-secondary border-primary flex items-center justify-between border-b px-6 py-4"
        >
            <h3 class="text-text text-xl font-bold">
                {entry ? 'Upravit předmět' : 'Přidat předmět'}
            </h3>
            <button
                onclick={onClose}
                class="text-text icon-lg opacity-50 transition hover:opacity-100"
                aria-label="Close"
            >
                <i class="bi bi-x-lg"></i>
            </button>
        </div>

        <div class="space-y-4 p-6 text-base">
            <!-- Typ: Přednáška vs Cvičení -->
            <div class="flex space-x-4">
                <button
                    class="flex flex-1 items-center justify-center space-x-2 rounded-lg border-2 px-4 py-2 transition
                    {type === 'lecture'
                        ? 'border-red-500 bg-red-900/20 text-red-400'
                        : 'border-primary text-text opacity-70 hover:opacity-100'}"
                    onclick={() => (type = 'lecture')}
                >
                    <div class="h-3 w-3 rounded-full bg-red-500"></div>
                    <span class="font-medium">Přednáška</span>
                </button>
                <button
                    class="flex flex-1 items-center justify-center space-x-2 rounded-lg border-2 px-4 py-2 transition
                    {type === 'practice'
                        ? 'border-blue-500 bg-blue-900/20 text-blue-400'
                        : 'border-primary text-text opacity-70 hover:opacity-100'}"
                    onclick={() => (type = 'practice')}
                >
                    <div class="h-3 w-3 rounded-full bg-blue-500"></div>
                    <span class="font-medium">Cvičení</span>
                </button>
            </div>

            <div class="space-y-3">
                <div>
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label class="text-text mb-1 block text-base font-medium opacity-80"
                        >Zkratka / Název předmětu</label
                    >
                    <input
                        bind:value={subject}
                        placeholder="např. MAT, FYZ"
                        class="bg-secondary border-primary focus:ring-accent focus:border-accent text-text placeholder-text/30 w-full rounded-lg border p-2 transition outline-none focus:ring-2"
                    />
                </div>

                <div>
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label class="text-text mb-1 block text-base font-medium opacity-80"
                        >Popis / Typ výuky</label
                    >
                    <input
                        bind:value={title}
                        placeholder="např. Přednáška, Cvičení, Laborky"
                        class="bg-secondary border-primary focus:ring-accent focus:border-accent text-text placeholder-text/30 w-full rounded-lg border p-2 transition outline-none focus:ring-2"
                    />
                </div>

                <div>
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label class="text-text mb-1 block text-base font-medium opacity-80"
                        >Místnost (volitelné)</label
                    >
                    <input
                        bind:value={room}
                        placeholder="např. B103"
                        class="bg-secondary border-primary focus:ring-accent focus:border-accent text-text placeholder-text/30 w-full rounded-lg border p-2 transition outline-none focus:ring-2"
                    />
                </div>
            </div>

            <!-- Time Selection -->
            <div class="space-y-2">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="text-text block text-base font-medium opacity-80">Čas</label
                >

                <div class="flex items-center space-x-2">
                    <input
                        type="time"
                        bind:value={startTime}
                        class="border-primary bg-secondary text-text rounded border p-2 text-base"
                        aria-label="Start time"
                    />
                    <span class="text-text opacity-50">-</span>
                    <input
                        type="time"
                        bind:value={endTime}
                        class="border-primary bg-secondary text-text rounded border p-2 text-base"
                        aria-label="End time"
                    />
                </div>

                <div class="text-text mt-2 text-sm font-medium opacity-60">
                    Rychlé nastavení:
                </div>
                <div class="flex flex-wrap gap-2">
                    {#each TIME_BLOCKS.slice(0, 8) as block, i (i)}
                        <button
                            class="bg-secondary hover:bg-primary/20 hover:border-primary border-primary text-text rounded border px-2 py-1 text-sm transition"
                            onclick={() => setBlock(block.start, block.end)}
                        >
                            {i + 1}. ({block.start})
                        </button>
                    {/each}
                    <!-- More blocks can be added if needed -->
                </div>
            </div>
        </div>

        <div
            class="bg-secondary bg-opacity-50 border-primary flex justify-between border-t px-6 py-4"
        >
            <div>
                {#if entry?.id}
                    <button
                        class="rounded px-4 py-2 font-medium text-red-500 transition hover:bg-red-900/20 hover:text-red-400"
                        onclick={() => entry?.id && onDelete(entry.id)}
                    >
                        <i class="bi bi-trash me-1"></i> Smazat
                    </button>
                {/if}
            </div>
            <div class="space-x-2">
                <button
                    class="text-text hover:bg-primary/20 rounded-lg px-4 py-2 font-medium opacity-70 transition"
                    onclick={onClose}
                >
                    Zrušit
                </button>
                <button
                    class="bg-accent hover:bg-accent/80 transform rounded-lg px-6 py-2 font-medium text-white shadow-md transition hover:-translate-y-0.5"
                    onclick={save}
                >
                    Uložit
                </button>
            </div>
        </div>
    </div>
</div>
