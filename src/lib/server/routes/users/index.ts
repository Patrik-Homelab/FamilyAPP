import type { ErrorList } from '$/lib/errors';
import type { Permission } from '$/lib/permissions';
import type { Response, ResponseWithData } from '$/types/types';
import type { ErrorApiResponse } from '@patrick115/sveltekitapi';
import { z } from 'zod';
import { permProcedure } from '../../api';
import { conn } from '../../variables';
import bankSettings from './bankSettings';

export const USER_PERMISSION = 'admin.users' as Permission;

export const userProcedure = permProcedure([USER_PERMISSION]);

export default [
    userProcedure.GET.query(async ({ ctx }) => {
        const users = await conn
            .selectFrom('user')
            .leftJoin('user_group', 'user.id', 'user_id')
            .selectAll()
            .where('user.family_id', '=', ctx.family_id)
            .execute();

        return {
            status: true,
            data: users.map((user) => ({
                ...user,
                user_id: undefined,
                password: undefined
            }))
        } satisfies ResponseWithData<unknown>;
    }),
    userProcedure.PATCH.input(
        z.object({
            id: z.number(),
            group: z.number().nullable()
        })
    ).query(async ({ input, ctx }) => {
        const targetUser = await conn
            .selectFrom('user')
            .select('id')
            .where('id', '=', input.id)
            .where('family_id', '=', ctx.family_id)
            .executeTakeFirst();

        if (!targetUser) {
            return {
                status: false,
                code: 404,
                message: 'users.notFound' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        if (input.group !== null) {
            const targetGroup = await conn
                .selectFrom('group')
                .select('id')
                .where('id', '=', input.group)
                .where('family_id', '=', ctx.family_id)
                .executeTakeFirst();

            if (!targetGroup) {
                return {
                    status: false,
                    code: 404,
                    message: 'groups.notFound' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }
        }

        //check if already exists
        const result = await conn
            .selectFrom('user_group')
            .selectAll()
            .where('user_id', '=', input.id)
            .executeTakeFirst();

        try {
            if (!result) {
                if (!input.group) {
                    return {
                        status: false,
                        code: 401,
                        message: 'Tento uživatel nemá skupinu'
                    } satisfies ErrorApiResponse;
                }

                await conn
                    .insertInto('user_group')
                    .values({
                        user_id: input.id,
                        group_id: input.group
                    })
                    .execute();
            } else if (input.group) {
                await conn
                    .updateTable('user_group')
                    .set({
                        group_id: input.group
                    })
                    .where('user_id', '=', input.id)
                    .execute();
            } else {
                await conn
                    .deleteFrom('user_group')
                    .where('user_id', '=', input.id)
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
                message: 'Nepovedlo se nastavit skupinu'
            } satisfies ErrorApiResponse;
        }
    }),
    // Sub-route for bankSettings endpoint
    {
        bankSettings
    }
];
