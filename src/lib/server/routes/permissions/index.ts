import type { ErrorList } from '$/lib/errors';
import type { Response, ResponseWithData, UserData } from '$/types/types';
import type { ErrorApiResponse } from '@patrick115/sveltekitapi';
import { z } from 'zod';
import { loggedProcedure, permProcedure } from '../../api';
import { getUserFamilyContext, setSessionCookie } from '../../functions';
import { conn } from '../../variables';
import { GROUP_PERMISSION } from '../groups';

const groupPermProcedure = permProcedure([GROUP_PERMISSION]);

export default [
    loggedProcedure.GET.query(async ({ ctx, ev: { cookies } }) => {
        const refreshed = await getUserFamilyContext(ctx.id);
        if (!refreshed) {
            return {
                status: false,
                code: 401,
                message: 'Unauthorized'
            } satisfies ErrorApiResponse;
        }

        setSessionCookie(cookies, refreshed);

        return {
            status: true,
            data: {
                permissions: refreshed.permissions,
                group: refreshed.group,
                family_name: refreshed.family_name,
                ha_enabled: refreshed.ha_enabled
            }
        } satisfies ResponseWithData<{
            permissions: UserData['permissions'];
            group: UserData['group'];
            family_name: string;
            ha_enabled: boolean;
        }>;
    }),
    groupPermProcedure.PUT.input(
        z.object({
            id: z.number(),
            permission: z.string()
        })
    ).query(async ({ input, ctx }) => {
        try {
            const group = await conn
                .selectFrom('group')
                .select('id')
                .where('id', '=', input.id)
                .where('family_id', '=', ctx.family_id)
                .executeTakeFirst();

            if (!group) {
                return {
                    status: false,
                    code: 404,
                    message: 'groups.notFound' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }

            await conn
                .insertInto('group_permissions')
                .values({
                    group_id: input.id,
                    permission: input.permission
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
                message: 'Něco se nepovedlo na serveru :('
            } satisfies ErrorApiResponse;
        }
    }),
    groupPermProcedure.DELETE.input(
        z.object({
            id: z.number(),
            permission: z.string()
        })
    ).query(async ({ input, ctx }) => {
        try {
            const group = await conn
                .selectFrom('group')
                .select('id')
                .where('id', '=', input.id)
                .where('family_id', '=', ctx.family_id)
                .executeTakeFirst();

            if (!group) {
                return {
                    status: false,
                    code: 404,
                    message: 'groups.notFound' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }

            await conn
                .deleteFrom('group_permissions')
                .where((eb) =>
                    eb.and([
                        eb('group_id', '=', input.id),
                        eb('permission', '=', input.permission)
                    ])
                )
                .execute();

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
    })
];
