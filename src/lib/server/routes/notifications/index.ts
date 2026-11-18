import type { ErrorList } from '$/lib/errors';
import type { Permission } from '$/lib/permissions';
import type { Response } from '$/types/types';
import type { ErrorApiResponse } from '@patrick115/sveltekitapi';
import { z } from 'zod';
import { permProcedure } from '../../api';
import { sendNotification } from '../../functions';
import { conn } from '../../variables';

export const NOTIFICATION_PERMISSION = 'admin.notifications' as Permission;

const notificationProcedure = permProcedure([NOTIFICATION_PERMISSION]);

const send = notificationProcedure.POST.input(
    z.object({
        userId: z.number(),
        title: z.string().min(1).trim(),
        body: z.string().min(1).trim()
    })
).query(async ({ input, ctx }) => {
    try {
        const targetUser = await conn
            .selectFrom('user')
            .select('id')
            .where('id', '=', input.userId)
            .where('family_id', '=', ctx.family_id)
            .executeTakeFirst();

        if (!targetUser) {
            return {
                status: false,
                code: 404,
                message: 'users.notFound' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        await sendNotification(input.userId, {
            title: input.title,
            body: input.body
        });

        return {
            status: true
        } satisfies Response;
    } catch (err) {
        console.error(err);
        return {
            status: false,
            code: 500,
            message: 'Něco se nepovedlo na serveru :('
        } satisfies ErrorApiResponse;
    }
});

export default {
    send
};
