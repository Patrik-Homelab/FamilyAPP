import type { Response } from '$/types/types';
import type { ErrorApiResponse } from '@patrick115/sveltekitapi';
import z from 'zod';
import { loggedProcedure } from '../../api';
import { conn } from '../../variables';

export default [
    loggedProcedure.PUT.input(z.string()).query(async ({ ctx }) => {
        try {
            await conn
                .insertInto('enabled_temp_notifications')
                .values({
                    userId: ctx.id
                })
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
