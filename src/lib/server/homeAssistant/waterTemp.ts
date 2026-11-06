export interface WaterTempPoint {
    x: Date;
    y: number;
}

export class HomeAssistantWaterTemp {
    private getUrl(): string {
        return (
            process.env.HOME_ASSISTANT_URL?.replace(/\/+$/, '') ||
            'https://ha.patrick115.eu'
        );
    }

    private getToken(): string {
        return (
            process.env.HOME_ASSISTANT_TOKEN ||
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI2YzYwNDUyMzZmOWM0ODQ0ODI2NjkwYWRjY2IxMzg0YiIsImlhdCI6MTc5Mzk3NjQzMywiZXhwIjoyMTA5MzM2NDMzfQ.pcDhPNewlFIbz8bIbLUibT3xyH3yX1r-Ah75ZoB_45c'
        );
    }

    private getUpEntity(): string {
        return (
            process.env.HA_WATER_UP_ENTITY ||
            'sensor.energyface_controller_10_10_10_90_energyface_bojler_nahore'
        );
    }

    private getDownEntity(): string {
        return (
            process.env.HA_WATER_DOWN_ENTITY ||
            'sensor.energyface_controller_10_10_10_90_energyface_bojler_dole'
        );
    }

    /**
     * Fetch historical temperatures for a specific calendar day from Home Assistant.
     * Returns [lower, upper] datasets matching the legacy EnergyFace signature.
     */
    async getWaterTempDay(
        year: number,
        month: number,
        day: number
    ): Promise<[WaterTempPoint[], WaterTempPoint[]]> {
        const upEntity = this.getUpEntity();
        const downEntity = this.getDownEntity();

        const startDate = new Date(year, month, day, 0, 0, 0, 0);
        const endDate = new Date(year, month, day, 23, 59, 59, 999);

        const filterEntities = encodeURIComponent(`${upEntity},${downEntity}`);
        const startTime = encodeURIComponent(startDate.toISOString());
        const endTime = encodeURIComponent(endDate.toISOString());

        const url = `${this.getUrl()}/api/history/period/${startTime}?filter_entity_id=${filterEntities}&end_time=${endTime}&minimal_response`;

        try {
            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.getToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) {
                console.error(
                    `Home Assistant history API returned status ${res.status}: ${await res.text()}`
                );
                return [[], []];
            }

            const data = (await res.json()) as Array<
                Array<{
                    entity_id?: string;
                    state: string;
                    last_changed: string;
                }>
            >;

            if (!Array.isArray(data)) {
                return [[], []];
            }

            let lower: WaterTempPoint[] = [];
            let upper: WaterTempPoint[] = [];

            for (const list of data) {
                if (!Array.isArray(list) || list.length === 0) continue;
                const entityId = list[0].entity_id;

                const points: WaterTempPoint[] = [];
                for (const entry of list) {
                    const y = parseFloat(entry.state);
                    if (isNaN(y)) continue;
                    const x = new Date(entry.last_changed);
                    if (isNaN(x.getTime())) continue;

                    points.push({ x, y });
                }

                if (entityId === upEntity) {
                    upper = points;
                } else if (entityId === downEntity) {
                    lower = points;
                }
            }

            return [lower, upper];
        } catch (err) {
            console.error('Failed to fetch water temperature from Home Assistant:', err);
            return [[], []];
        }
    }

    /**
     * Get the latest real-time upper temperature from Home Assistant states API.
     */
    async getCurrentUpperTemp(): Promise<{ temp: number; timestamp: Date } | null> {
        const upEntity = this.getUpEntity();
        const url = `${this.getUrl()}/api/states/${encodeURIComponent(upEntity)}`;

        try {
            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.getToken()}`,
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
            console.error('Failed to get current upper temp from Home Assistant:', err);
            return null;
        }
    }
}

export const haWaterTemp = new HomeAssistantWaterTemp();
