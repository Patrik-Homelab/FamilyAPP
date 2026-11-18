import type { ErrorList } from '$/lib/errors';
import type { Response } from '$/types/types';
import type { ErrorApiResponse } from '@patrick115/sveltekitapi';
import z from 'zod';
import { loggedProcedure } from '../../api';
import { conn } from '../../variables';

export default [
    loggedProcedure.PUT.input(z.string()).query(async ({ ctx }) => {
        try {
            const config = await conn
                .selectFrom('family_ha_config')
                .select('enabled')
                .where('family_id', '=', ctx.family_id)
                .executeTakeFirst();

            if (!config || config.enabled !== 1) {
                return {
                    status: false,
                    code: 400,
                    message: 'family.haDisabled' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }

            const existing = await conn
                .selectFrom('enabled_temp_notifications')
                .select('userId')
                .where('userId', '=', ctx.id)
                .executeTakeFirst();

            if (!existing) {
                await conn
                    .insertInto('enabled_temp_notifications')
                    .values({
                        userId: ctx.id
                    })
                    .execute();
            }

            return {
                status: true
            } satisfies Response;
        } catch (err) {
            console.error(err);
            return {
                status: false,
                code: 500,
                message: 'Internal Server Error'
            } satisfies ErrorApiResponse;
        }
    }),
    loggedProcedure.DELETE.input(z.string()).query(async ({ ctx }) => {
        try {
            await conn
                .deleteFrom('enabled_temp_notifications')
                .where('userId', '=', ctx.id)
                .execute();
            return {
                status: true
            } satisfies Response;
        } catch (err) {
            console.error(err);
            return {
                status: false,
                code: 500,
                message: 'Internal Server Error'
            } satisfies ErrorApiResponse;
        }
    })
];
