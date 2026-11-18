<script lang="ts">
    import { Button, Entry, Input, Select } from '$/components/form';
    import Title from '$/components/headers/Title.svelte';
    import Icon from '$/components/Icon.svelte';
    import { API } from '$/lib/api';
    import { extractError } from '$/lib/errors';
    import { SwalAlert } from '$/lib/functions';
    import type { DiscoveredHaSensor } from '$/lib/server/homeAssistant/waterTemp';
    import { getState, logged } from '$/lib/state.svelte';
    import { page } from '$app/state';
    import type { PageProps } from './$types';

    const { data }: PageProps = $props();
    const _state = getState();

    const DEFAULT_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

    const initial = data.settings.status ? data.settings.data : null;

    let familyName = $state(initial?.family.name ?? '');
    let joinCode = $state(initial?.family.join_code ?? '');
    let allowJoinCode = $state(initial?.family.allow_join_code ?? true);
    let defaultGroupId = $state<number | null>(initial?.family.default_group_id ?? null);
    const groups = initial?.groups ?? [];

    let haEnabled = $state(initial?.ha.enabled ?? false);
    let haUrl = $state(initial?.ha.ha_url ?? '');
    let haToken = $state('');
    let hasStoredToken = $state(initial?.ha.hasToken ?? false);
    let alertsEnabled = $state(initial?.ha.alerts_enabled ?? false);
    let alertMinTemp = $state(initial?.ha.alert_min_temp ?? 30);
    let alertMaxTemp = $state(initial?.ha.alert_max_temp ?? 75);

    type SensorFormRow = {
        entity_id: string;
        label: string;
        color: string;
    };

    let sensors = $state<SensorFormRow[]>(
        initial?.ha.sensors.map((s) => ({
            entity_id: s.entity_id,
            label: s.label,
            color: s.color
        })) ?? []
    );

    const initialAlertIndex = initial?.ha.alert_sensor_id
        ? Math.max(
              0,
              initial.ha.sensors.findIndex((s) => s.id === initial.ha.alert_sensor_id)
          )
        : 0;
    let alertSensorIndex = $state<number>(initialAlertIndex);

    let discoveredSensors = $state<DiscoveredHaSensor[]>([]);
    let testingHa = $state(false);
    let savingGeneral = $state(false);
    let savingHa = $state(false);

    const saveGeneral = async (regenerateJoinCode = false) => {
        if (!familyName.trim()) {
            SwalAlert({ icon: 'error', title: 'Název rodiny nesmí být prázdný' });
            return;
        }

        savingGeneral = true;
        try {
            const res = await API.family.settings.PATCH({
                name: familyName.trim(),
                allow_join_code: allowJoinCode,
                default_group_id: defaultGroupId,
                regenerateJoinCode
            });

            if (!res.status) {
                SwalAlert({ icon: 'error', title: extractError(res.message) });
                return;
            }

            joinCode = res.data.join_code;
            familyName = res.data.name;

            if (logged(_state.userState)) {
                _state.userState.data.family_name = res.data.name;
            }

            SwalAlert({
                icon: 'success',
                title: regenerateJoinCode
                    ? 'Kód rodiny byl obnoven'
                    : 'Nastavení rodiny uloženo'
            });
        } finally {
            savingGeneral = false;
        }
    };

    const copyJoinLink = async () => {
        const link = `${page.url.origin}/join/${joinCode}`;
        try {
            await navigator.clipboard.writeText(link);
            SwalAlert({ icon: 'success', title: 'Odkaz pro připojení zkopírován' });
        } catch {
            SwalAlert({
                toast: false,
                timer: 0,
                position: 'center',
                title: link,
                showConfirmButton: true,
                confirmButtonText: 'Ok'
            });
        }
    };

    const addSensor = (entityId = '', label = '') => {
        const nextColor = DEFAULT_COLORS[sensors.length % DEFAULT_COLORS.length];
        sensors.push({
            entity_id: entityId,
            label,
            color: nextColor
        });
    };

    const removeSensor = (idx: number) => {
        sensors.splice(idx, 1);
        if (alertSensorIndex >= sensors.length) {
            alertSensorIndex = Math.max(0, sensors.length - 1);
        }
    };

    const testHaConnection = async () => {
        if (!haUrl.trim()) {
            SwalAlert({ icon: 'error', title: 'Zadej Home Assistant URL' });
            return;
        }

        testingHa = true;
        try {
            const res = await API.family.testHa({
                ha_url: haUrl.trim(),
                ha_token: haToken.trim() || undefined
            });

            if (!res.status) {
                SwalAlert({ icon: 'error', title: extractError(res.message) });
                return;
            }

            discoveredSensors = res.data;
            SwalAlert({
                icon: 'success',
                title: `Připojení úspěšné (nalezeno ${res.data.length} teplotních senzorů)`
            });
        } finally {
            testingHa = false;
        }
    };

    const saveHa = async () => {
        if (haEnabled && sensors.length === 0) {
            SwalAlert({
                icon: 'error',
                title: 'Přidej alespoň jeden teplotní senzor'
            });
            return;
        }

        if (haEnabled && sensors.some((s) => !s.entity_id.trim() || !s.label.trim())) {
            SwalAlert({
                icon: 'error',
                title: 'Vyplň prosím název i Entity ID u všech senzorů'
            });
            return;
        }

        savingHa = true;
        try {
            const res = await API.family.ha.PUT({
                enabled: haEnabled,
                ha_url: haUrl.trim(),
                ha_token: haToken.trim() || undefined,
                alerts_enabled: alertsEnabled,
                alert_sensor_index: sensors.length > 0 ? alertSensorIndex : null,
                alert_min_temp: Number(alertMinTemp),
                alert_max_temp: Number(alertMaxTemp),
                sensors: sensors.map((s) => ({
                    entity_id: s.entity_id.trim(),
                    label: s.label.trim(),
                    color: s.color
                }))
            });

            if (!res.status) {
                SwalAlert({ icon: 'error', title: extractError(res.message) });
                return;
            }

            if (haToken.trim()) {
                hasStoredToken = true;
                haToken = '';
            }

            if (logged(_state.userState)) {
                _state.userState.data.ha_enabled = haEnabled;
            }

            SwalAlert({
                icon: 'success',
                title: 'Nastavení Home Assistant bylo uloženo'
            });
        } finally {
            savingHa = false;
        }
    };
</script>

<section class="flex flex-1 flex-col gap-6 p-4">
    <Title>Nastavení rodiny</Title>

    <!-- General Family Settings -->
    <div class="bg-secondary flex flex-col gap-4 rounded-lg p-4 shadow-md">
        <h2 class="text-xl font-bold">Obecné nastavení</h2>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Entry id="family-name" label="Název rodiny">
                <Input id="family-name" bind:value={familyName} />
            </Entry>

            <Entry id="default-group" label="Výchozí skupina pro nové členy">
                <Select id="default-group" bind:value={defaultGroupId}>
                    <option value={null}>Žádná</option>
                    {#each groups as group (group.id)}
                        <option value={group.id}>{group.name}</option>
                    {/each}
                </Select>
            </Entry>
        </div>

        <div class="border-primary flex flex-col gap-2 rounded-md border p-3">
            <label class="flex cursor-pointer items-center gap-2 font-bold">
                <input type="checkbox" bind:checked={allowJoinCode} />
                <span>Povolit připojení nových členů pomocí kódu rodiny</span>
            </label>

            <div class="flex flex-wrap items-center gap-2">
                <span>Kód rodiny:</span>
                <code class="bg-background rounded px-2 py-1 text-lg font-bold"
                    >{joinCode}</code
                >
                <Button onclick={copyJoinLink} class="w-auto px-3 py-1 text-base">
                    <Icon name="bi-clipboard" /> Kopírovat odkaz
                </Button>
                <Button
                    onclick={() => saveGeneral(true)}
                    disabled={savingGeneral}
                    class="w-auto bg-amber-600 px-3 py-1 text-base hover:bg-amber-700"
                >
                    <Icon name="bi-arrow-repeat" /> Obnovit kód
                </Button>
            </div>
        </div>

        <div>
            <Button
                onclick={() => saveGeneral(false)}
                disabled={savingGeneral}
                class="w-full md:w-auto"
            >
                {savingGeneral ? 'Ukládám...' : 'Uložit obecné nastavení'}
            </Button>
        </div>
    </div>

    <!-- Home Assistant / Water Temperature Settings -->
    <div class="bg-secondary flex flex-col gap-4 rounded-lg p-4 shadow-md">
        <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-xl font-bold">Home Assistant – Teplota vody</h2>
            <label class="flex cursor-pointer items-center gap-2 font-bold">
                <input type="checkbox" bind:checked={haEnabled} />
                <span>Povolit sledování teploty vody</span>
            </label>
        </div>

        {#if haEnabled}
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Entry id="ha-url" label="Home Assistant URL">
                    <Input
                        id="ha-url"
                        placeholder="https://ha.example.com"
                        bind:value={haUrl}
                    />
                </Entry>

                <Entry
                    id="ha-token"
                    label="Long-Lived Access Token"
                    note={hasStoredToken ? '(uložen – vyplňte jen pro změnu)' : undefined}
                >
                    <Input
                        id="ha-token"
                        type="password"
                        placeholder={hasStoredToken
                            ? '•••••••• (ponechte prázdné pro zachování)'
                            : 'Vložte Home Assistant token'}
                        bind:value={haToken}
                    />
                </Entry>
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <Button
                    onclick={testHaConnection}
                    disabled={testingHa}
                    class="w-auto bg-sky-600 px-4 py-2 hover:bg-sky-700"
                >
                    {testingHa
                        ? 'Testuji spojení...'
                        : 'Otestovat připojení & načíst senzory'}
                </Button>
            </div>

            {#if discoveredSensors.length > 0}
                <div class="border-primary flex flex-col gap-2 rounded-md border p-3">
                    <h3 class="font-bold">
                        Nalezené teplotní senzory v Home Assistant ({discoveredSensors.length}):
                    </h3>
                    <div class="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm">
                        {#each discoveredSensors as ds (ds.entity_id)}
                            <div
                                class="bg-background flex items-center justify-between gap-2 rounded p-2"
                            >
                                <div class="min-w-0 flex-1">
                                    <div class="truncate font-bold">{ds.name}</div>
                                    <div class="truncate opacity-75">
                                        {ds.entity_id} ({ds.state}
                                        {ds.unit ?? ''})
                                    </div>
                                </div>
                                <Button
                                    onclick={() => addSensor(ds.entity_id, ds.name)}
                                    class="w-auto px-2 py-1 text-xs"
                                >
                                    + Přidat
                                </Button>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Configured Sensors -->
            <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-bold">
                        Sledované senzory ({sensors.length})
                    </h3>
                    <Button
                        onclick={() => addSensor()}
                        class="w-auto bg-green-600 px-3 py-1 text-base hover:bg-green-700"
                    >
                        <Icon name="bi-plus-lg" /> Přidat senzor
                    </Button>
                </div>

                {#if sensors.length === 0}
                    <p class="text-sm opacity-75">
                        Zatím není nakonfigurovaný žádný senzor. Můžete přidat 1 nebo více
                        senzorů (např. jen jeden bojler, nebo horní a spodní čidlo).
                    </p>
                {/if}

                {#each sensors as sensor, idx (idx)}
                    <div
                        class="border-primary grid grid-cols-1 items-end gap-2 rounded-md border p-3 md:grid-cols-[1fr_2fr_auto_auto]"
                    >
                        <Entry label="Popisek">
                            <Input
                                placeholder="např. Voda nahoře"
                                bind:value={sensor.label}
                            />
                        </Entry>
                        <Entry label="Entity ID v Home Assistant">
                            <Input
                                placeholder="sensor.bojler_teplota"
                                bind:value={sensor.entity_id}
                            />
                        </Entry>
                        <div class="flex flex-col gap-1">
                            <span class="text-sm font-bold">Barva</span>
                            <input
                                type="color"
                                bind:value={sensor.color}
                                class="h-10 w-14 cursor-pointer rounded border-0 bg-transparent"
                            />
                        </div>
                        <Button
                            onclick={() => removeSensor(idx)}
                            class="w-auto bg-red-600 px-3 py-2 hover:bg-red-700"
                            title="Odebrat senzor"
                        >
                            <Icon name="bi-trash-fill" />
                        </Button>
                    </div>
                {/each}
            </div>

            <!-- Temperature Alert Settings -->
            <div class="border-primary flex flex-col gap-3 rounded-md border p-3">
                <label class="flex cursor-pointer items-center gap-2 font-bold">
                    <input type="checkbox" bind:checked={alertsEnabled} />
                    <span>Povolit push upozornění při mimořádné teplotě</span>
                </label>

                {#if alertsEnabled && sensors.length > 0}
                    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <Entry label="Senzor pro upozornění">
                            <Select bind:value={alertSensorIndex}>
                                {#each sensors as sensor, idx (idx)}
                                    <option value={idx}>
                                        {sensor.label ||
                                            sensor.entity_id ||
                                            `Senzor #${idx + 1}`}
                                    </option>
                                {/each}
                            </Select>
                        </Entry>
                        <Entry label="Minimální teplota (°C)">
                            <Input type="number" step="0.5" bind:value={alertMinTemp} />
                        </Entry>
                        <Entry label="Maximální teplota (°C)">
                            <Input type="number" step="0.5" bind:value={alertMaxTemp} />
                        </Entry>
                    </div>
                {/if}
            </div>
        {/if}

        <div>
            <Button onclick={saveHa} disabled={savingHa} class="w-full md:w-auto">
                {savingHa ? 'Ukládám...' : 'Uložit Home Assistant nastavení'}
            </Button>
        </div>
    </div>
</section>
