<script lang="ts">
    import { Button } from '$/components/form';
    import MonthSelector from '$/components/form/MonthSelector.svelte';
    import Icon from '$/components/Icon.svelte';
    import { API } from '$/lib/api';
    import { extractError } from '$/lib/errors';
    import { Calendar, SwalAlert } from '$/lib/functions';
    import { getState } from '$/lib/state.svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import Chart from 'chart.js/auto';
    import 'chartjs-adapter-date-fns';
    import { onMount } from 'svelte';
    import { SvelteDate, SvelteSet } from 'svelte/reactivity';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();

    let canvas = $state<HTMLCanvasElement>();
    const calendar = new Calendar();

    const today = new Date();
    let year = $state(today.getFullYear());
    let month = $state(today.getMonth());
    let day = $state(today.getDate());
    let maxDays = $state(calendar.getLastDayOfMonth(today).getDate());

    let lastUpdate = new SvelteDate();
    let sensorSummaries = $state<
        { id: number; label: string; color: string; lastValue: number | null }[]
    >([]);
    let topToday = $state(0);

    let loadedDays = new SvelteSet<string>();
    let loadingDay = false;
    let panThrottleTimer: ReturnType<typeof setTimeout> | null = null;

    const dateKey = (y: number, m: number, d: number) => `${y}-${m}-${d}`;

    $effect(() => {
        maxDays = calendar.getLastDayOfMonth(new Date(year, month)).getDate();
        if (day > maxDays) {
            day = maxDays;
        }
    });

    const nextDay = () => {
        const date = new Date(year, month, day + 1);
        if (date > today) return;
        year = date.getFullYear();
        month = date.getMonth();
        day = date.getDate();
        loadDayData(year, month, day, 'replace');
    };

    const previousDay = () => {
        const date = new Date(year, month, day - 1);
        year = date.getFullYear();
        month = date.getMonth();
        day = date.getDate();
        loadDayData(year, month, day, 'replace');
    };

    const handleKeys = (ev: KeyboardEvent) => {
        if (ev.key === 'ArrowLeft') {
            previousDay();
        } else if (ev.key === 'ArrowRight') {
            nextDay();
        }
    };

    let chart: Chart<'line', { x: Date; y: number }[]> | undefined;

    const baseDatasetConfig = {
        tension: 0.3,
        pointRadius: 0,
        fill: false
    };

    const loadDayData = async (
        y: number,
        m: number,
        d: number,
        mode: 'replace' | 'prepend' | 'append'
    ) => {
        const key = dateKey(y, m, d);
        if (loadedDays.has(key) && mode !== 'replace') return;
        if (loadingDay) return;

        loadingDay = true;
        const res = await API.energyface.get({ year: y, month: m, day: d });
        loadingDay = false;

        if (!res.status || !chart) {
            if (mode === 'replace') {
                SwalAlert({
                    icon: 'error',
                    title: res.status
                        ? 'Nepodařilo se načíst data'
                        : extractError(res.message ?? 'Nepodařilo se načíst data')
                });
            }
            return;
        }

        const seriesList = res.data.sensors || [];
        const parsedSeries = seriesList.map((s) => ({
            id: s.id,
            label: s.label,
            color: s.color,
            points: (s.points || []).map((pt: { x: string | Date; y: number }) => ({
                x: new Date(pt.x),
                y: pt.y
            }))
        }));

        loadedDays.add(key);

        if (mode === 'replace') {
            loadedDays.clear();
            loadedDays.add(key);

            chart.data.datasets = parsedSeries.map((s) => ({
                label: s.label,
                data: s.points,
                borderColor: s.color,
                backgroundColor: s.color,
                ...baseDatasetConfig
            }));

            if (
                typeof (chart as unknown as { resetZoom?: (mode?: string) => void })
                    .resetZoom === 'function'
            ) {
                (chart as unknown as { resetZoom: (mode?: string) => void }).resetZoom(
                    'none'
                );
            }
            chart.update();
        } else if (mode === 'prepend') {
            parsedSeries.forEach((s, idx) => {
                if (!chart!.data.datasets[idx]) return;
                chart!.data.datasets[idx].data = [
                    ...s.points,
                    ...(chart!.data.datasets[idx].data as { x: Date; y: number }[])
                ];
            });
            chart.update('none');
        } else if (mode === 'append') {
            parsedSeries.forEach((s, idx) => {
                if (!chart!.data.datasets[idx]) return;
                chart!.data.datasets[idx].data = [
                    ...(chart!.data.datasets[idx].data as { x: Date; y: number }[]),
                    ...s.points
                ];
            });
            chart.update('none');
        }

        const allPoints = parsedSeries.flatMap((s) => s.points);
        if (allPoints.length > 0) {
            const latestDate = allPoints.reduce(
                (max, pt) => (pt.x > max ? pt.x : max),
                allPoints[0].x
            );
            lastUpdate.setHours(latestDate.getHours(), latestDate.getMinutes(), 0, 0);
            topToday = allPoints.reduce(
                (max, cur) => (cur.y > max ? cur.y : max),
                -Infinity
            );
            if (!isFinite(topToday)) topToday = 0;

            sensorSummaries = parsedSeries.map((s) => ({
                id: s.id,
                label: s.label,
                color: s.color,
                lastValue: s.points.length > 0 ? s.points[s.points.length - 1].y : null
            }));
        } else if (mode === 'replace') {
            topToday = 0;
            sensorSummaries = parsedSeries.map((s) => ({
                id: s.id,
                label: s.label,
                color: s.color,
                lastValue: null
            }));
        }
    };

    const checkAndLoadAdjacentDays = (chartInstance: Chart) => {
        const xAxis = chartInstance.scales.x;
        if (!xAxis) return;

        const minTime = xAxis.min;
        const maxTime = xAxis.max;

        let dataMin = Infinity;
        let dataMax = -Infinity;

        for (const ds of chartInstance.data.datasets) {
            const pts = ds.data as unknown as { x: Date; y: number }[] | undefined;
            if (!pts || pts.length === 0) continue;
            const firstTime = new Date(pts[0].x).getTime();
            const lastTime = new Date(pts[pts.length - 1].x).getTime();
            if (firstTime < dataMin) dataMin = firstTime;
            if (lastTime > dataMax) dataMax = lastTime;
        }

        if (!isFinite(dataMin) || !isFinite(dataMax)) return;

        if (minTime < dataMin + 2 * 60 * 60 * 1000) {
            const earliestDate = new Date(dataMin);
            const prevDate = new Date(
                earliestDate.getFullYear(),
                earliestDate.getMonth(),
                earliestDate.getDate() - 1
            );
            loadDayData(
                prevDate.getFullYear(),
                prevDate.getMonth(),
                prevDate.getDate(),
                'prepend'
            );
        }

        if (maxTime > dataMax - 2 * 60 * 60 * 1000) {
            const latestDate = new Date(dataMax);
            const nextDate = new Date(
                latestDate.getFullYear(),
                latestDate.getMonth(),
                latestDate.getDate() + 1
            );
            if (nextDate <= today) {
                loadDayData(
                    nextDate.getFullYear(),
                    nextDate.getMonth(),
                    nextDate.getDate(),
                    'append'
                );
            }
        }

        const centerDate = new Date((minTime + maxTime) / 2);
        if (
            centerDate.getFullYear() !== year ||
            centerDate.getMonth() !== month ||
            centerDate.getDate() !== day
        ) {
            year = centerDate.getFullYear();
            month = centerDate.getMonth();
            day = centerDate.getDate();
        }
    };

    onMount(() => {
        if (!data.haEnabled) return;

        window.addEventListener('keydown', handleKeys);
        let destroyed = false;

        import('chartjs-plugin-zoom').then((module) => {
            if (destroyed || !canvas) return;
            Chart.register(module.default);

            chart = new Chart(canvas, {
                type: 'line',
                data: {
                    datasets: []
                },
                options: {
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'minute',
                                displayFormats: {
                                    minute: 'HH:mm',
                                    hour: 'HH:mm'
                                },
                                tooltipFormat: 'HH:mm'
                            },
                            ticks: {
                                color: 'white',
                                font: {
                                    size: 14,
                                    weight: 'bold'
                                }
                            }
                        },
                        y: {
                            ticks: {
                                color: 'white',
                                font: {
                                    size: 14
                                }
                            }
                        }
                    },
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    animation: {
                        duration: 0
                    },
                    plugins: {
                        zoom: {
                            pan: {
                                enabled: true,
                                mode: 'x',
                                onPan: ({ chart: chartInstance }) => {
                                    if (!panThrottleTimer) {
                                        panThrottleTimer = setTimeout(() => {
                                            panThrottleTimer = null;
                                            checkAndLoadAdjacentDays(chartInstance);
                                        }, 250);
                                    }
                                },
                                onPanComplete: ({ chart: chartInstance }) => {
                                    if (panThrottleTimer) {
                                        clearTimeout(panThrottleTimer);
                                        panThrottleTimer = null;
                                    }
                                    checkAndLoadAdjacentDays(chartInstance);
                                }
                            },
                            zoom: {
                                wheel: {
                                    enabled: true
                                },
                                pinch: {
                                    enabled: true
                                },
                                mode: 'x'
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (ctx) =>
                                    `${ctx.dataset.label}: ${ctx.formattedValue} °C`
                            },
                            titleFont: {
                                size: 16
                            },
                            bodyFont: {
                                size: 14
                            },
                            footerFont: {
                                size: 12
                            },
                            backgroundColor: '#222',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            footerColor: '#ccc'
                        },
                        legend: {
                            labels: {
                                color: 'white',
                                font: {
                                    size: 14
                                }
                            }
                        }
                    }
                }
            });

            loadDayData(year, month, day, 'replace');
        });

        return () => {
            destroyed = true;
            window.removeEventListener('keydown', handleKeys);
            if (panThrottleTimer) {
                clearTimeout(panThrottleTimer);
                panThrottleTimer = null;
            }
            chart?.destroy();
            chart = undefined;
        };
    });

    $effect(() => {
        if (!data.haEnabled) return;
        const date = new Date(year, month, day);
        if (date > today) {
            year = today.getFullYear();
            month = today.getMonth();
            day = today.getDate();
            return;
        }

        const key = dateKey(year, month, day);
        if (chart && !loadedDays.has(key)) {
            loadDayData(year, month, day, 'replace');
        }
    });

    const resetZoom = () => {
        if (!chart) return;
        if (
            typeof (chart as unknown as { resetZoom?: () => void }).resetZoom ===
            'function'
        ) {
            (chart as unknown as { resetZoom: () => void }).resetZoom();
        }
        loadDayData(year, month, day, 'replace');
    };

    const resetDay = () => {
        const isAlreadyToday =
            year === today.getFullYear() &&
            month === today.getMonth() &&
            day === today.getDate();

        if (isAlreadyToday) {
            resetZoom();
        } else {
            year = today.getFullYear();
            month = today.getMonth();
            day = today.getDate();
            resetZoom();
        }
    };

    const _state = getState();

    let subscribed = $state(data.subscribed);

    const toggleNotifications = async () => {
        if (!_state.pushEnabled) {
            SwalAlert({
                icon: 'info',
                title: 'Pro povolení notifikací ohledně teploty vody je potřeba mít povolené notifikace v aplikaci.',
                timer: 10000
            });
            return;
        }

        if (subscribed) {
            const confirm = await SwalAlert({
                toast: false,
                timer: 0,
                position: 'center',
                title: 'Opravdu se chceš odhlásit z notifikací?',
                showConfirmButton: true,
                confirmButtonText: 'Ano',
                showCancelButton: true,
                cancelButtonText: 'Ne'
            });
            if (!confirm) return;

            const result = await API.energyface.subscription.DELETE('');
            if (!result.status) {
                SwalAlert({
                    icon: 'error',
                    title: 'Nepodařilo se odhlásit z notifikací'
                });
                return;
            }
            subscribed = false;
            SwalAlert({
                icon: 'success',
                title: 'Byl jsi úspěšně odhlášen z notifikací'
            });
            return;
        }

        const confirmation = await SwalAlert({
            toast: false,
            timer: 0,
            position: 'center',
            title: 'Opravdu se chceš přihlásit k notifikacím ohledně teploty vody?',
            showConfirmButton: true,
            confirmButtonText: 'Ano',
            showCancelButton: true,
            cancelButtonText: 'Ne'
        });
        if (!confirmation) return;

        const subscription = await API.energyface.subscription.PUT('');
        if (!subscription.status) {
            SwalAlert({
                icon: 'error',
                title: 'Nepodařilo se přihlásit k notifikacím'
            });
            return;
        }
        subscribed = true;
        SwalAlert({
            icon: 'success',
            title: 'Byl jsi úspěšně přihlášen k notifikacím'
        });
    };
</script>

{#if !data.haEnabled}
    <section
        class="bg-secondary/70 mx-auto my-auto flex max-w-lg flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 p-8 text-center shadow-xl"
    >
        <div
            class="bg-accent/15 text-accent border-accent/30 flex h-14 w-14 items-center justify-center rounded-2xl border text-3xl"
        >
            <Icon name="bi-thermometer-half" />
        </div>
        <h2 class="font-poppins text-xl font-bold lg:text-2xl">
            Sledování teploty vody není nastaveno
        </h2>
        <p class="text-text/70 text-sm">
            Pro zobrazení grafů teploty je potřeba v nastavení rodiny připojit Home
            Assistant a vybrat alespoň jeden senzor.
        </p>
        {#if data.canConfigureFamily}
            <Button
                onclick={() => goto(`/${page.params.family}/family-settings`)}
                class="w-auto px-5"
            >
                Otevřít nastavení rodiny
            </Button>
        {/if}
    </section>
{:else}
    <section class="flex flex-1 flex-col gap-4 pb-6">
        <!-- Toolbar -->
        <div
            class="bg-secondary/80 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-3 shadow-sm"
        >
            <button
                type="button"
                onclick={toggleNotifications}
                class={[
                    'inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
                    subscribed
                        ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                        : 'text-text/75 border-white/15 bg-white/5 hover:bg-white/10'
                ]}
            >
                <Icon name={subscribed ? 'bi-bell-fill' : 'bi-bell'} />
                <span class="hidden sm:inline"
                    >{subscribed ? 'Upozornění zapnuta' : 'Zapnout upozornění'}</span
                >
            </button>

            <div class="flex flex-wrap items-center gap-1.5">
                <button
                    type="button"
                    onclick={previousDay}
                    class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/10 transition-colors hover:bg-white/10"
                    aria-label="Předchozí den"
                >
                    <Icon name="bi-chevron-left" />
                </button>
                <select
                    bind:value={year}
                    class="bg-secondary text-text rounded-xl border border-white/15 px-2.5 py-1.5 text-sm font-semibold outline-hidden"
                >
                    <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
                    {#each Array.from({ length: 10 }) as _, i (i)}
                        {@const y = year - 5 + i}
                        <option value={y}>{y}</option>
                    {/each}
                </select>
                <MonthSelector class="text-sm font-semibold" bind:value={month} />
                <select
                    bind:value={day}
                    class="bg-secondary text-text rounded-xl border border-white/15 px-2.5 py-1.5 text-sm font-semibold outline-hidden"
                >
                    <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
                    {#each Array.from({ length: maxDays }) as _, i (i)}
                        <option value={i + 1}>{i + 1}</option>
                    {/each}
                </select>
                <button
                    type="button"
                    onclick={nextDay}
                    class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/10 transition-colors hover:bg-white/10"
                    aria-label="Další den"
                >
                    <Icon name="bi-chevron-right" />
                </button>
            </div>

            <div class="flex items-center gap-2">
                <button
                    type="button"
                    onclick={resetZoom}
                    class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/15 text-amber-400 transition-colors hover:bg-white/10"
                    title="Obnovit přiblížení"
                >
                    <Icon name="bi-zoom-out" />
                </button>
                <button
                    type="button"
                    onclick={resetDay}
                    class="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 px-3 text-sm font-semibold transition-colors hover:bg-white/10"
                    title="Dnešní den"
                >
                    <Icon name="bi-arrow-counterclockwise" />
                    <span class="hidden sm:inline">Dnes</span>
                </button>
            </div>
        </div>

        <!-- KPI Summary Cards -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div
                class="bg-secondary/75 flex flex-col gap-1 rounded-2xl border border-white/10 p-3.5"
            >
                <span class="text-text/55 text-xs font-medium">Poslední aktualizace</span>
                <span class="font-poppins text-lg font-bold">
                    {lastUpdate.toLocaleString('cs-CZ', {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </span>
            </div>
            <div
                class="bg-secondary/75 flex flex-col gap-1 rounded-2xl border border-white/10 p-3.5"
            >
                <span class="text-text/55 text-xs font-medium">Maximum dnes</span>
                <span class="font-poppins text-lg font-bold text-amber-400">
                    {topToday} °C
                </span>
            </div>
            {#each sensorSummaries as s (s.id)}
                <div
                    class="bg-secondary/75 flex flex-col gap-1 rounded-2xl border border-white/10 p-3.5"
                >
                    <span
                        class="text-text/65 flex items-center gap-1.5 truncate text-xs font-medium"
                    >
                        <span
                            class="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style="background-color: {s.color};"
                        ></span>
                        <span class="truncate">{s.label}</span>
                    </span>
                    <span class="font-poppins text-lg font-bold" style="color: {s.color}">
                        {s.lastValue !== null ? `${s.lastValue} °C` : '—'}
                    </span>
                </div>
            {/each}
        </div>

        <!-- Chart Canvas -->
        <div
            class="bg-secondary/75 min-h-[380px] flex-1 rounded-2xl border border-white/10 p-4 shadow-sm"
        >
            <canvas bind:this={canvas}></canvas>
        </div>
    </section>
{/if}
