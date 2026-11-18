export interface WaterTempPoint {
    x: Date;
    y: number;
}

export interface WaterTempSensorConfig {
    id: number;
    entity_id: string;
    label: string;
    color: string;
}

export interface WaterTempSeries extends WaterTempSensorConfig {
    points: WaterTempPoint[];
}

export interface DiscoveredHaSensor {
    entity_id: string;
    name: string;
    unit?: string;
    state?: string;
}

export class HomeAssistantWaterTemp {
    private normalizeUrl(url: string): string {
        return url.trim().replace(/\/+$/, '');
    }

    /**
     * Fetch historical temperatures for a specific calendar day from Home Assistant
     * for 1..N configured sensors.
     */
    async getWaterTempDay(
        config: {
            haUrl: string;
            haToken: string;
            sensors: WaterTempSensorConfig[];
        },
        year: number,
        month: number,
        day: number
    ): Promise<WaterTempSeries[]> {
        if (config.sensors.length === 0) {
            return [];
        }

        const baseUrl = this.normalizeUrl(config.haUrl);
        if (!baseUrl || !config.haToken) {
            return config.sensors.map((s) => ({ ...s, points: [] }));
        }

        const startDate = new Date(year, month, day, 0, 0, 0, 0);
        const endDate = new Date(year, month, day, 23, 59, 59, 999);

        const filterEntities = encodeURIComponent(
            config.sensors.map((s) => s.entity_id).join(',')
        );
        const startTime = encodeURIComponent(startDate.toISOString());
        const endTime = encodeURIComponent(endDate.toISOString());

        const url = `${baseUrl}/api/history/period/${startTime}?filter_entity_id=${filterEntities}&end_time=${endTime}&minimal_response`;

        try {
            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${config.haToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) {
                console.error(
                    `Home Assistant history API returned status ${res.status}: ${await res.text()}`
                );
                return config.sensors.map((s) => ({ ...s, points: [] }));
            }

            const data = (await res.json()) as Array<
                Array<{
                    entity_id?: string;
                    state: string;
                    last_changed: string;
                }>
            >;

            const pointsByEntity = new Map<string, WaterTempPoint[]>();

            if (Array.isArray(data)) {
                for (const list of data) {
                    if (!Array.isArray(list) || list.length === 0) continue;
                    const entityId = list[0].entity_id;
                    if (!entityId) continue;

                    const points: WaterTempPoint[] = [];
                    for (const entry of list) {
                        const y = parseFloat(entry.state);
                        if (isNaN(y)) continue;
                        const x = new Date(entry.last_changed);
                        if (isNaN(x.getTime())) continue;

                        points.push({ x, y });
                    }

                    pointsByEntity.set(entityId, points);
                }
            }

            return config.sensors.map((sensor) => ({
                ...sensor,
                points: pointsByEntity.get(sensor.entity_id) ?? []
            }));
        } catch (err) {
            console.error('Failed to fetch water temperature from Home Assistant:', err);
            return config.sensors.map((s) => ({ ...s, points: [] }));
        }
    }

    /**
     * Get the latest real-time temperature for a given sensor entity from Home Assistant.
     */
    async getCurrentTemp(
        haUrl: string,
        haToken: string,
        entityId: string
    ): Promise<{ temp: number; timestamp: Date } | null> {
        const baseUrl = this.normalizeUrl(haUrl);
        if (!baseUrl || !haToken || !entityId) {
            return null;
        }

        const url = `${baseUrl}/api/states/${encodeURIComponent(entityId)}`;

        try {
            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${haToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) {
                console.error(
                    `Home Assistant state API returned status ${res.status}: ${await res.text()}`
                );
                return null;
            }

            const data = (await res.json()) as {
                state: string;
                last_changed?: string;
                last_updated?: string;
            };

            const temp = parseFloat(data.state);
            if (isNaN(temp)) return null;

            const dateStr = data.last_changed || data.last_updated;
            const timestamp = dateStr ? new Date(dateStr) : new Date();

            return { temp, timestamp };
        } catch (err) {
            console.error('Failed to get current temp from Home Assistant:', err);
            return null;
        }
    }

    /**
     * Test connectivity to Home Assistant and list available temperature sensors.
     */
    async testConnection(
        haUrl: string,
        haToken: string
    ): Promise<{ ok: boolean; error?: string; sensors: DiscoveredHaSensor[] }> {
        const baseUrl = this.normalizeUrl(haUrl);
        if (!baseUrl || !haToken) {
            return { ok: false, error: 'Chybí URL nebo token', sensors: [] };
        }

        try {
            const res = await fetch(`${baseUrl}/api/states`, {
                headers: {
                    Authorization: `Bearer ${haToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) {
                return {
                    ok: false,
                    error: `Home Assistant odpověděl chybou ${res.status}`,
                    sensors: []
                };
            }

            const states = (await res.json()) as Array<{
                entity_id: string;
                state: string;
                attributes?: {
                    friendly_name?: string;
                    device_class?: string;
                    unit_of_measurement?: string;
                };
            }>;

            const sensors: DiscoveredHaSensor[] = (Array.isArray(states) ? states : [])
                .filter((s) => {
                    if (!s.entity_id?.startsWith('sensor.')) return false;
                    const devClass = s.attributes?.device_class;
                    const unit = s.attributes?.unit_of_measurement;
                    return (
                        devClass === 'temperature' ||
                        unit === '°C' ||
                        unit === '°F' ||
                        unit === 'C'
                    );
                })
                .map((s) => ({
                    entity_id: s.entity_id,
                    name: s.attributes?.friendly_name || s.entity_id,
                    unit: s.attributes?.unit_of_measurement,
                    state: s.state
                }))
                .sort((a, b) => a.name.localeCompare(b.name));

            return { ok: true, sensors };
        } catch (err) {
            console.error('HA testConnection error:', err);
            return {
                ok: false,
                error: 'Nepodařilo se navázat spojení se serverem Home Assistant',
                sensors: []
            };
        }
    }
}

export const haWaterTemp = new HomeAssistantWaterTemp();
