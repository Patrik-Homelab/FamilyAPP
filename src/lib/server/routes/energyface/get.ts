import type { ErrorList } from '$/lib/errors';
import type { ErrorApiResponse } from '@patrick115/sveltekitapi';
import z from 'zod';
import { loggedProcedure } from '../../api';
import { decryptSecret } from '../../crypto';
import { haWaterTemp } from '../../homeAssistant/waterTemp';
import { conn } from '../../variables';

export default loggedProcedure.POST.input(
    z.object({
        year: z.number(),
        month: z.number(),
        day: z.number()
    })
).query(async ({ input, ctx }) => {
    const config = await conn
        .selectFrom('family_ha_config')
        .selectAll()
        .where('family_id', '=', ctx.family_id)
        .executeTakeFirst();

    if (!config || config.enabled !== 1) {
        return {
            status: false,
            code: 400,
            message: 'family.haDisabled' satisfies ErrorList
        } satisfies ErrorApiResponse;
    }

    const sensors = await conn
        .selectFrom('family_ha_sensor')
        .select(['id', 'entity_id', 'label', 'color'])
        .where('family_id', '=', ctx.family_id)
        .orderBy('sort_order', 'asc')
        .orderBy('id', 'asc')
        .execute();

    let haToken = '';
    try {
        haToken = decryptSecret(config.ha_token_encrypted);
    } catch (err) {
        console.error('Failed to decrypt HA token for family', ctx.family_id, err);
        return {
            status: false,
            code: 500,
            message: 'family.haConnectionFailed' satisfies ErrorList
        } satisfies ErrorApiResponse;
    }

    const series = await haWaterTemp.getWaterTempDay(
        {
            haUrl: config.ha_url,
            haToken,
            sensors
        },
        input.year,
        input.month,
        input.day
    );

    return {
        status: true,
        data: {
            sensors: series
        }
    };
});
