import { toDate } from '$/lib/functions';
import { decryptSecret } from '../crypto';
import { sendNotificationToMultiple, type Cron } from '../functions';
import { haWaterTemp } from '../homeAssistant/waterTemp';
import { conn } from '../variables';

enum IncidentType {
    NONE = 0,
    LOW = 1,
    HIGH = 2
}

const getIncidentType = (
    temp: number,
    minTemp: number,
    maxTemp: number
): IncidentType => {
    if (temp < minTemp) return IncidentType.LOW;
    if (temp > maxTemp) return IncidentType.HIGH;
    return IncidentType.NONE;
};

export default [
    '0 */30 * * * *',
    async () => {
        const configs = await conn
            .selectFrom('family_ha_config')
            .innerJoin('family', 'family.id', 'family_ha_config.family_id')
            .select([
                'family_ha_config.family_id',
                'family_ha_config.ha_url',
                'family_ha_config.ha_token_encrypted',
                'family_ha_config.alert_sensor_id',
                'family_ha_config.alert_min_temp',
                'family_ha_config.alert_max_temp',
                'family_ha_config.last_incident_state',
                'family.uuid as family_uuid'
            ])
            .where('family_ha_config.enabled', '=', 1)
            .where('family_ha_config.alerts_enabled', '=', 1)
            .execute();

        for (const config of configs) {
            const sensors = await conn
                .selectFrom('family_ha_sensor')
                .select(['id', 'entity_id', 'label'])
                .where('family_id', '=', config.family_id)
                .orderBy('sort_order', 'asc')
                .orderBy('id', 'asc')
                .execute();

            if (sensors.length === 0) continue;

            const alertSensor =
                (config.alert_sensor_id
                    ? sensors.find((s) => s.id === config.alert_sensor_id)
                    : undefined) ?? sensors[0];

            let haToken = '';
            try {
                haToken = decryptSecret(config.ha_token_encrypted);
            } catch (err) {
                console.error(
                    `Failed to decrypt HA token for family ${config.family_id}:`,
                    err
                );
                continue;
            }

            const current = await haWaterTemp.getCurrentTemp(
                config.ha_url,
                haToken,
                alertSensor.entity_id
            );
            if (!current) {
                console.error(
                    `No temperature data available from Home Assistant for family ${config.family_id} (${alertSensor.entity_id})`
                );
                continue;
            }

            const minTemp = parseFloat(config.alert_min_temp);
            const maxTemp = parseFloat(config.alert_max_temp);
            const currentIncident = getIncidentType(current.temp, minTemp, maxTemp);
            const previousIncident = config.last_incident_state as IncidentType;

            if (currentIncident === IncidentType.NONE) {
                if (previousIncident !== IncidentType.NONE) {
                    const registered = await conn
                        .selectFrom('enabled_temp_notifications')
                        .innerJoin('user', 'user.id', 'enabled_temp_notifications.userId')
                        .select('enabled_temp_notifications.userId')
                        .where('user.family_id', '=', config.family_id)
                        .execute();

                    await sendNotificationToMultiple(
                        registered.map((r) => r.userId),
                        {
                            title: 'Teplota vody se normalizovala',
                            body: `${alertSensor.label} v ${toDate(current.timestamp)} je nyní ${current.temp} °C a vrátila se do normálního rozsahu.`,
                            data: {
                                url: `/${config.family_uuid}/water-temperature`
                            }
                        }
                    );

                    await conn
                        .updateTable('family_ha_config')
                        .set({
                            last_incident_state: IncidentType.NONE,
                            last_incident_temp: null,
                            last_incident_at: null
                        })
                        .where('family_id', '=', config.family_id)
                        .execute();
                }
                continue;
            }

            if (previousIncident !== currentIncident) {
                const registered = await conn
                    .selectFrom('enabled_temp_notifications')
                    .innerJoin('user', 'user.id', 'enabled_temp_notifications.userId')
                    .select('enabled_temp_notifications.userId')
                    .where('user.family_id', '=', config.family_id)
                    .execute();

                const rangeText =
                    currentIncident === IncidentType.LOW
                        ? 'pod minimální hodnotu'
                        : 'nad maximální hodnotu';

                await sendNotificationToMultiple(
                    registered.map((r) => r.userId),
                    {
                        title: 'Varování ohledně teploty vody',
                        body: `${alertSensor.label} v ${toDate(current.timestamp)} dosáhla ${current.temp} °C, což je ${rangeText} povoleného rozsahu.`,
                        data: {
                            url: `/${config.family_uuid}/water-temperature`
                        }
                    }
                );

                await conn
                    .updateTable('family_ha_config')
                    .set({
                        last_incident_state: currentIncident,
                        last_incident_temp: current.temp.toFixed(2),
                        last_incident_at: current.timestamp
                    })
                    .where('family_id', '=', config.family_id)
                    .execute();
            }
        }
    }
] satisfies Cron;
