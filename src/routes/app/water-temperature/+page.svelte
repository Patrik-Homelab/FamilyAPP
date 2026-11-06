<script lang="ts">
    import MonthSelector from '$/components/form/MonthSelector.svelte';
    import Icon from '$/components/Icon.svelte';
    import { API } from '$/lib/api';
    import { Calendar, SwalAlert } from '$/lib/functions';
    import { getState } from '$/lib/state.svelte';
    import Chart from 'chart.js/auto';
    import 'chartjs-adapter-date-fns';
    import { onMount } from 'svelte';
    import { SvelteDate } from 'svelte/reactivity';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();

    let canvas: HTMLCanvasElement;
    const calendar = new Calendar();

    const today = new Date();
    let year = $state(today.getFullYear());
    let month = $state(today.getMonth());
    let day = $state(today.getDate());
    let maxDays = $state(calendar.getLastDayOfMonth(today).getDate());

    let lastUpdate = new SvelteDate();
    let lastUpper = $state(0);
    let lastLower = $state(0);

    let topToday = $state(0);

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
    };

    const previousDay = () => {
        const date = new Date(year, month, day - 1);
        year = date.getFullYear();
        month = date.getMonth();
        day = date.getDate();
    };

    const handleKeys = (ev: KeyboardEvent) => {
        if (ev.key === 'ArrowLeft') {
            previousDay();
        } else if (ev.key === 'ArrowRight') {
            nextDay();
        }
    };

    let chart: Chart<'line', { x: Date; y: number }[]>;

    const loadData = async (year: number, month: number, day: number) => {
        if (!chart) return;
        const data = await API.energyface.get({ year, month, day });
        if (!data.status) {
            SwalAlert({
                icon: 'error',
                title: 'Nepodařilo se načíst data'
            });
            return;
        }
        const { lower, upper } = data.data;
        const parsedLower = (lower || []).map((d: { x: string | Date; y: number }) => ({
            x: new Date(d.x),
            y: d.y
        }));
        const parsedUpper = (upper || []).map((d: { x: string | Date; y: number }) => ({
            x: new Date(d.x),
            y: d.y
        }));

        chart.data.datasets[0].data = parsedLower;
        chart.data.datasets[1].data = parsedUpper;

        chart.update();

        if (parsedLower.length > 0 || parsedUpper.length > 0) {
            const _lastLower = parsedLower[parsedLower.length - 1];
            const _lastUpper = parsedUpper[parsedUpper.length - 1];

            if (_lastLower && _lastUpper) {
                const lastDate =
                    _lastLower.x > _lastUpper.x ? _lastLower.x : _lastUpper.x;
                lastUpdate.setHours(lastDate.getHours(), lastDate.getMinutes(), 0, 0);
                lastLower = _lastLower.y;
                lastUpper = _lastUpper.y;
            } else if (_lastLower) {
                lastUpdate.setHours(
                    _lastLower.x.getHours(),
                    _lastLower.x.getMinutes(),
                    0,
                    0
                );
                lastLower = _lastLower.y;
            } else if (_lastUpper) {
                lastUpdate.setHours(
                    _lastUpper.x.getHours(),
                    _lastUpper.x.getMinutes(),
                    0,
                    0
                );
                lastUpper = _lastUpper.y;
            }

            topToday = [...parsedUpper, ...parsedLower].reduce(
                (max, cur) => (cur.y > max ? cur.y : max),
                0
            );
        } else {
            lastLower = 0;
            lastUpper = 0;
            topToday = 0;
        }
    };

    onMount(() => {
        window.addEventListener('keydown', handleKeys);

        const baseConfig = {
            lineTension: 0.3,
            pointRadius: 0,
            fill: false
        };

        chart = new Chart(canvas, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Voda dole',
                        data: [],
                        borderColor: 'oklch(62.3% 0.214 259.815)',
                        backgroundColor: 'oklch(62.3% 0.214 259.815)',
                        ...baseConfig
                    },
                    {
                        label: 'Voda nahoře',
                        data: [],
                        borderColor: 'oklch(63.7% 0.237 25.331)',
                        backgroundColor: 'oklch(63.7% 0.237 25.331)',
                        ...baseConfig
                    }
                ]
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
                maintainAspectRatio: false,
                responsive: true
            }
        });

        loadData(year, month, day);

        return () => {
            window.removeEventListener('keydown', handleKeys);

            chart.destroy();
        };
    });

    $effect(() => {
        const date = new Date(year, month, day);
        if (date > today) {
            year = today.getFullYear();
            month = today.getMonth();
            day = today.getDate();
            return;
        }
        loadData(year, month, day);
    });

    const resetDay = () => {
        const isAlreadyToday =
            year === today.getFullYear() &&
            month === today.getMonth() &&
            day === today.getDate();

        if (isAlreadyToday) {
            // Force reload if we're already viewing today
            loadData(year, month, day);
        } else {
            // Set to today's date (will trigger reactive effect)
            year = today.getFullYear();
            month = today.getMonth();
            day = today.getDate();
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

<section class="flex flex-1 flex-col">
    <div class="flex w-full gap-2 text-2xl">
        <Icon
            onclick={toggleNotifications}
            name={subscribed ? 'bi-bell-fill' : 'bi-bell'}
            class="mr-auto"
        />
        <Icon onclick={previousDay} name="bi-chevron-left" />
        <select bind:value={year}>
            <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
            {#each Array.from({ length: 10 }) as _, i (i)}
                {@const y = year - 5 + i}
                <option value={y}>{y}</option>
            {/each}
        </select>
        <MonthSelector bind:value={month} />
        <select bind:value={day}>
            <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
            {#each Array.from({ length: maxDays }) as _, i (i)}
                <option value={i + 1}>{i + 1}</option>
            {/each}
        </select>
        <Icon onclick={nextDay} name="bi-chevron-right" />
        <Icon name="bi-arrow-counterclockwise" onclick={resetDay} class="ml-auto" />
    </div>
    <div class="mx-auto flex flex-col text-2xl font-bold">
        <h2>
            Poslední aktualizace: {lastUpdate.toLocaleString('cs-CZ', {
                hour: '2-digit',
                minute: '2-digit'
            })}
        </h2>
        <h2>Nejvíce dnes: {topToday} °C</h2>
        <h2 class="text-red-500">Voda nahoře: {lastUpper} °C</h2>
        <h2 class="text-blue-500">Voda dole: {lastLower} °C</h2>
    </div>
    <div class="flex-1">
        <canvas bind:this={canvas}></canvas>
    </div>
</section>
