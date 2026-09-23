<script lang="ts" module>
    export type RouteSegmentLocal = {
        transport_type: 'bus' | 'car';
        start_time: string; // HH:MM string (car only)
        end_time: string; // HH:MM string (car only)
        start_station: string; // bus only
        end_station: string; // bus only
    };
</script>

<script lang="ts">
    let {
        day,
        direction,
        segments: initialSegments,
        onSave,
        onClose
    } = $props<{
        day: number;
        direction: 'morning' | 'evening';
        segments: RouteSegmentLocal[];
        onSave: (segments: RouteSegmentLocal[]) => void;
        onClose: () => void;
    }>();

    const dayNames = [
        'Pondělí',
        'Úterý',
        'Středa',
        'Čtvrtek',
        'Pátek',
        'Sobota',
        'Neděle'
    ];

    let segments = $state<RouteSegmentLocal[]>(
        initialSegments.length > 0
            ? initialSegments.map((s: RouteSegmentLocal) => ({ ...s }))
            : []
    );

    function addSegment(type: 'bus' | 'car') {
        segments = [
            ...segments,
            {
                transport_type: type,
                start_time: '',
                end_time: '',
                start_station: '',
                end_station: ''
            }
        ];
    }

    function removeSegment(index: number) {
        segments = segments.filter((_, i) => i !== index);
    }

    function moveUp(index: number) {
        if (index === 0) return;
        const copy = [...segments];
        [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
        segments = copy;
    }

    function moveDown(index: number) {
        if (index === segments.length - 1) return;
        const copy = [...segments];
        [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
        segments = copy;
    }

    let validationError = $state('');

    function validate(): boolean {
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            if (seg.transport_type === 'car') {
                if (!seg.start_time || !seg.end_time) {
                    validationError = `Úsek #${i + 1} (Auto): vyplňte čas odjezdu i příjezdu.`;
                    return false;
                }
            } else {
                if (!seg.start_station.trim() || !seg.end_station.trim()) {
                    validationError = `Úsek #${i + 1} (Autobus): vyplňte nástupní i výstupní zastávku.`;
                    return false;
                }
            }
        }
        validationError = '';
        return true;
    }

    function save() {
        if (!validate()) return;
        onSave(segments);
    }
</script>

<div
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
>
    <div
        class="bg-background border-primary flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-2xl"
    >
        <!-- Header -->
        <div
            class="bg-secondary border-primary flex flex-shrink-0 items-center justify-between border-b px-6 py-4"
        >
            <h3 class="text-text text-xl font-bold">
                {direction === 'morning' ? 'Ranní' : 'Odpolední'} trasa — {dayNames[day]}
            </h3>
            <button
                onclick={onClose}
                class="text-text icon-lg opacity-50 transition hover:opacity-100"
                aria-label="Close"
            >
                <i class="bi bi-x-lg"></i>
            </button>
        </div>

        <!-- Segments list -->
        <div class="flex-1 space-y-3 overflow-y-auto p-6">
            {#if segments.length === 0}
                <p class="text-text text-center opacity-40">
                    Žádné úseky. Přidejte první níže.
                </p>
            {/if}

            {#each segments as seg, i (i)}
                <div class="border-primary bg-secondary rounded-lg border p-3">
                    <!-- Segment header: type badge + move buttons + remove -->
                    <div class="mb-2 flex items-center gap-2">
                        <span
                            class="rounded px-2 py-0.5 text-xs font-semibold {seg.transport_type ===
                            'bus'
                                ? 'bg-blue-600 text-white'
                                : 'bg-orange-600 text-white'}"
                        >
                            <i
                                class="bi {seg.transport_type === 'bus'
                                    ? 'bi-bus-front'
                                    : 'bi-car-front'} me-1"
                            ></i>
                            {seg.transport_type === 'bus' ? 'Autobus' : 'Auto'}
                        </span>
                        <span class="text-text text-xs opacity-50">#{i + 1}</span>

                        <div class="ml-auto flex gap-1">
                            <button
                                onclick={() => moveUp(i)}
                                disabled={i === 0}
                                class="border-primary bg-background text-text rounded border p-1 text-xs disabled:opacity-30"
                                aria-label="Move up"
                            >
                                <i class="bi bi-chevron-up"></i>
                            </button>
                            <button
                                onclick={() => moveDown(i)}
                                disabled={i === segments.length - 1}
                                class="border-primary bg-background text-text rounded border p-1 text-xs disabled:opacity-30"
                                aria-label="Move down"
                            >
                                <i class="bi bi-chevron-down"></i>
                            </button>
                            <button
                                onclick={() => removeSegment(i)}
                                class="border-primary bg-background rounded border p-1 text-xs text-red-500 hover:bg-red-900/20"
                                aria-label="Remove segment"
                            >
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>

                    {#if seg.transport_type === 'car'}
                        <!-- Car: start and end times -->
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <!-- svelte-ignore a11y_label_has_associated_control -->
                                <label class="text-text mb-0.5 block text-xs opacity-70"
                                    >Odjezd</label
                                >
                                <input
                                    type="time"
                                    bind:value={seg.start_time}
                                    class="border-primary bg-background text-text w-full rounded border p-1.5 text-sm"
                                />
                            </div>
                            <div>
                                <!-- svelte-ignore a11y_label_has_associated_control -->
                                <label class="text-text mb-0.5 block text-xs opacity-70"
                                    >Příjezd</label
                                >
                                <input
                                    type="time"
                                    bind:value={seg.end_time}
                                    class="border-primary bg-background text-text w-full rounded border p-1.5 text-sm"
                                />
                            </div>
                        </div>
                    {:else}
                        <!-- Bus: start and end stations -->
                        <div class="space-y-2">
                            <div>
                                <!-- svelte-ignore a11y_label_has_associated_control -->
                                <label class="text-text mb-0.5 block text-xs opacity-70"
                                    >Nástupní zastávka</label
                                >
                                <input
                                    type="text"
                                    bind:value={seg.start_station}
                                    placeholder="např. Hlavní nádraží"
                                    class="border-primary bg-background text-text placeholder-text/30 w-full rounded border p-1.5 text-sm"
                                />
                            </div>
                            <div>
                                <!-- svelte-ignore a11y_label_has_associated_control -->
                                <label class="text-text mb-0.5 block text-xs opacity-70"
                                    >Výstupní zastávka</label
                                >
                                <input
                                    type="text"
                                    bind:value={seg.end_station}
                                    placeholder="např. Náměstí Svobody"
                                    class="border-primary bg-background text-text placeholder-text/30 w-full rounded border p-1.5 text-sm"
                                />
                            </div>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>

        <!-- Add segment buttons -->
        <div class="border-primary flex-shrink-0 border-t px-6 py-3">
            <p class="text-text mb-2 text-xs font-medium opacity-60">Přidat úsek:</p>
            <div class="flex gap-2">
                <button
                    onclick={() => addSegment('bus')}
                    class="flex flex-1 items-center justify-center gap-1 rounded-lg border-2 border-blue-600 bg-blue-900/20 px-3 py-2 text-sm font-medium text-blue-400 transition hover:bg-blue-900/40"
                >
                    <i class="bi bi-bus-front"></i> Autobus
                </button>
                <button
                    onclick={() => addSegment('car')}
                    class="flex flex-1 items-center justify-center gap-1 rounded-lg border-2 border-orange-600 bg-orange-900/20 px-3 py-2 text-sm font-medium text-orange-400 transition hover:bg-orange-900/40"
                >
                    <i class="bi bi-car-front"></i> Auto
                </button>
            </div>
        </div>

        <!-- Footer -->
        <div
            class="bg-secondary border-primary flex flex-shrink-0 flex-col gap-2 border-t px-6 py-4"
        >
            {#if validationError}
                <p class="text-sm text-red-400">{validationError}</p>
            {/if}
            <div class="flex justify-end gap-2">
                <button
                    onclick={onClose}
                    class="text-text hover:bg-primary/20 rounded-lg px-4 py-2 font-medium opacity-70 transition"
                >
                    Zrušit
                </button>
                <button
                    onclick={save}
                    class="bg-accent hover:bg-accent/80 rounded-lg px-6 py-2 font-medium text-white shadow-md transition"
                >
                    Uložit
                </button>
            </div>
        </div>
    </div>
</div>
