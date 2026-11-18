import type { ErrorList } from '$/lib/errors';
import type { Response, ResponseWithData } from '$/types/types';
import type { ErrorApiResponse } from '@patrick115/sveltekitapi';
import { z } from 'zod';
import { familyOwnerOrPermProcedure } from '../../api';
import { decryptSecret, encryptSecret } from '../../crypto';
import { hexColor } from '../../functions';
import { type DiscoveredHaSensor, haWaterTemp } from '../../homeAssistant/waterTemp';
import { conn } from '../../variables';
import { FAMILY_PERMISSION } from './settings';

const familyAdminProcedure = familyOwnerOrPermProcedure([FAMILY_PERMISSION]);

export const ha = [
    familyAdminProcedure.PUT.input(
        z.object({
            enabled: z.boolean(),
            ha_url: z.string().trim(),
            ha_token: z.string().trim().optional(),
            alerts_enabled: z.boolean(),
            alert_sensor_index: z.number().int().min(0).nullable(),
            alert_min_temp: z.number(),
            alert_max_temp: z.number(),
            sensors: z.array(
                z.object({
                    entity_id: z.string().trim().min(1).max(255),
                    label: z.string().trim().min(1).max(100),
                    color: hexColor
                })
            )
        })
    ).query(async ({ input, ctx }) => {
        const existingConfig = await conn
            .selectFrom('family_ha_config')
            .selectAll()
            .where('family_id', '=', ctx.family_id)
            .executeTakeFirst();

        if (input.enabled) {
            try {
                const parsedUrl = new URL(input.ha_url);
                if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                    throw new Error('Invalid protocol');
                }
            } catch {
                return {
                    status: false,
                    code: 400,
                    message: 'Zadej platnou URL Home Assistant (http:// nebo https://)'
                } satisfies ErrorApiResponse;
            }

            if (!input.ha_token && !existingConfig?.ha_token_encrypted) {
                return {
                    status: false,
                    code: 400,
                    message: 'Zadej Home Assistant přístupový token'
                } satisfies ErrorApiResponse;
            }

            if (input.sensors.length === 0) {
                return {
                    status: false,
                    code: 400,
                    message: 'family.invalidSensors' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }

            if (input.alerts_enabled && input.alert_min_temp >= input.alert_max_temp) {
                return {
                    status: false,
                    code: 400,
                    message: 'Minimální teplota musí být menší než maximální'
                } satisfies ErrorApiResponse;
            }
        }

        const encryptedToken = input.ha_token
            ? encryptSecret(input.ha_token)
            : (existingConfig?.ha_token_encrypted ?? '');

        const cleanUrl = input.ha_url.replace(/\/+$/, '');

        try {
            await conn.transaction().execute(async (trx) => {
                if (existingConfig) {
                    await trx
                        .updateTable('family_ha_config')
                        .set({
                            enabled: input.enabled ? 1 : 0,
                            ha_url: cleanUrl,
                            ha_token_encrypted: encryptedToken,
                            alerts_enabled: input.enabled && input.alerts_enabled ? 1 : 0,
                            alert_min_temp: input.alert_min_temp.toFixed(2),
                            alert_max_temp: input.alert_max_temp.toFixed(2),
                            last_incident_state: 0,
                            last_incident_temp: null,
                            last_incident_at: null,
                            updated_at: new Date()
                        })
                        .where('family_id', '=', ctx.family_id)
                        .execute();
                } else {
                    await trx
                        .insertInto('family_ha_config')
                        .values({
                            family_id: ctx.family_id,
                            enabled: input.enabled ? 1 : 0,
                            ha_url: cleanUrl,
                            ha_token_encrypted: encryptedToken,
                            alerts_enabled: input.enabled && input.alerts_enabled ? 1 : 0,
                            alert_sensor_id: null,
                            alert_min_temp: input.alert_min_temp.toFixed(2),
                            alert_max_temp: input.alert_max_temp.toFixed(2),
                            last_incident_state: 0
                        })
                        .execute();
                }

                await trx
                    .deleteFrom('family_ha_sensor')
                    .where('family_id', '=', ctx.family_id)
                    .execute();

                const insertedSensorIds: number[] = [];
                for (let i = 0; i < input.sensors.length; i++) {
                    const s = input.sensors[i];
                    const res = await trx
                        .insertInto('family_ha_sensor')
                        .values({
                            family_id: ctx.family_id,
                            entity_id: s.entity_id,
                            label: s.label,
                            color: s.color,
                            sort_order: i
                        })
                        .executeTakeFirstOrThrow();
                    insertedSensorIds.push(Number(res.insertId));
                }

                const alertIdx =
                    input.alert_sensor_index !== null &&
                    input.alert_sensor_index >= 0 &&
                    input.alert_sensor_index < insertedSensorIds.length
                        ? input.alert_sensor_index
                        : 0;

                await trx
                    .updateTable('family_ha_config')
                    .set({
                        alert_sensor_id:
                            insertedSensorIds.length > 0
                                ? insertedSensorIds[alertIdx]
                                : null
                    })
                    .where('family_id', '=', ctx.family_id)
                    .execute();
            });

            return {
                status: true
            } satisfies Response;
        } catch (err) {
            console.error('Failed to save family HA config:', err);
            return {
                status: false,
                code: 500,
                message: 'server.error' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }
    })
];

export const testHa = familyAdminProcedure.POST.input(
    z.object({
        ha_url: z.string().trim().min(1),
        ha_token: z.string().trim().optional()
    })
).query(async ({ input, ctx }) => {
    let token = input.ha_token || '';
    if (!token) {
        const existingConfig = await conn
            .selectFrom('family_ha_config')
            .select('ha_token_encrypted')
            .where('family_id', '=', ctx.family_id)
            .executeTakeFirst();

        if (!existingConfig?.ha_token_encrypted) {
            return {
                status: false,
                code: 400,
                message: 'Zadej Home Assistant token'
            } satisfies ErrorApiResponse;
        }

        token = decryptSecret(existingConfig.ha_token_encrypted);
    }

    const result = await haWaterTemp.testConnection(input.ha_url, token);
    if (!result.ok) {
        return {
            status: false,
            code: 400,
            message: result.error || ('family.haConnectionFailed' satisfies ErrorList)
        } satisfies ErrorApiResponse;
    }

    return {
        status: true,
        data: result.sensors
    } satisfies ResponseWithData<DiscoveredHaSensor[]>;
});
