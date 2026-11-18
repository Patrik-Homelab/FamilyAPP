import type { ErrorList } from '$/lib/errors';
import type { Permission } from '$/lib/permissions';
import type { ResponseWithData } from '$/types/types';
import type { ErrorApiResponse } from '@patrick115/sveltekitapi';
import crypto from 'node:crypto';
import { z } from 'zod';
import { familyOwnerOrPermProcedure } from '../../api';
import { conn } from '../../variables';

export const FAMILY_PERMISSION = 'admin.family' as Permission;

const familyAdminProcedure = familyOwnerOrPermProcedure([FAMILY_PERMISSION]);

export type FamilySettingsPayload = {
    family: {
        id: number;
        uuid: string;
        name: string;
        join_code: string;
        allow_join_code: boolean;
        default_group_id: number | null;
    };
    groups: { id: number; name: string }[];
    ha: {
        enabled: boolean;
        ha_url: string;
        hasToken: boolean;
        alerts_enabled: boolean;
        alert_sensor_id: number | null;
        alert_min_temp: number;
        alert_max_temp: number;
        sensors: {
            id: number;
            entity_id: string;
            label: string;
            color: string;
        }[];
    };
};

export default [
    familyAdminProcedure.GET.query(async ({ ctx }) => {
        const family = await conn
            .selectFrom('family')
            .select([
                'id',
                'uuid',
                'name',
                'join_code',
                'allow_join_code',
                'default_group_id'
            ])
            .where('id', '=', ctx.family_id)
            .executeTakeFirst();

        if (!family) {
            return {
                status: false,
                code: 404,
                message: 'family.notFound' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        const groups = await conn
            .selectFrom('group')
            .select(['id', 'name'])
            .where('family_id', '=', ctx.family_id)
            .orderBy('id', 'asc')
            .execute();

        const haConfig = await conn
            .selectFrom('family_ha_config')
            .selectAll()
            .where('family_id', '=', ctx.family_id)
            .executeTakeFirst();

        const sensors = await conn
            .selectFrom('family_ha_sensor')
            .select(['id', 'entity_id', 'label', 'color'])
            .where('family_id', '=', ctx.family_id)
            .orderBy('sort_order', 'asc')
            .orderBy('id', 'asc')
            .execute();

        return {
            status: true,
            data: {
                family: {
                    id: family.id,
                    uuid: family.uuid,
                    name: family.name,
                    join_code: family.join_code,
                    allow_join_code: family.allow_join_code === 1,
                    default_group_id: family.default_group_id
                },
                groups,
                ha: {
                    enabled: haConfig?.enabled === 1,
                    ha_url: haConfig?.ha_url ?? '',
                    hasToken: Boolean(haConfig?.ha_token_encrypted),
                    alerts_enabled: haConfig?.alerts_enabled === 1,
                    alert_sensor_id: haConfig?.alert_sensor_id ?? null,
                    alert_min_temp: haConfig ? parseFloat(haConfig.alert_min_temp) : 30,
                    alert_max_temp: haConfig ? parseFloat(haConfig.alert_max_temp) : 75,
                    sensors
                }
            }
        } satisfies ResponseWithData<FamilySettingsPayload>;
    }),
    familyAdminProcedure.PATCH.input(
        z.object({
            name: z.string().trim().min(1).max(100),
            allow_join_code: z.boolean(),
            default_group_id: z.number().nullable(),
            regenerateJoinCode: z.boolean().optional()
        })
    ).query(async ({ input, ctx }) => {
        if (input.default_group_id !== null) {
            const group = await conn
                .selectFrom('group')
                .select('id')
                .where('id', '=', input.default_group_id)
                .where('family_id', '=', ctx.family_id)
                .executeTakeFirst();

            if (!group) {
                return {
                    status: false,
                    code: 400,
                    message: 'groups.notFound' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }
        }

        const newJoinCode = input.regenerateJoinCode
            ? crypto.randomBytes(4).toString('hex').toUpperCase()
            : undefined;

        await conn
            .updateTable('family')
            .set({
                name: input.name,
                allow_join_code: input.allow_join_code ? 1 : 0,
                default_group_id: input.default_group_id,
                ...(newJoinCode ? { join_code: newJoinCode } : {})
            })
            .where('id', '=', ctx.family_id)
            .execute();

        const updated = await conn
            .selectFrom('family')
            .select(['join_code', 'name'])
            .where('id', '=', ctx.family_id)
            .executeTakeFirstOrThrow();

        return {
            status: true,
            data: {
                join_code: updated.join_code,
                name: updated.name
            }
        } satisfies ResponseWithData<{ join_code: string; name: string }>;
    })
];
