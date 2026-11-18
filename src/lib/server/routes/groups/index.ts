import type { ErrorList } from '$/lib/errors';
import type { Permission } from '$/lib/permissions';
import type { Response, ResponseWithData } from '$/types/types';
import type { ErrorApiResponse } from '@patrick115/sveltekitapi';
import { z } from 'zod';
import { permProcedure } from '../../api';
import { hexColor } from '../../functions';
import { conn } from '../../variables';

export const GROUP_PERMISSION = 'admin.groups' as Permission;

const groupProcedure = permProcedure([GROUP_PERMISSION]);

export default [
    groupProcedure.GET.query(async ({ ctx }) => {
        const groups = await conn
            .selectFrom('group')
            .selectAll()
            .where('family_id', '=', ctx.family_id)
            .execute();
        return {
            status: true,
            data: groups
        } satisfies ResponseWithData<typeof groups>;
    }),
    groupProcedure.PUT.input(
        z.object({
            name: z.string(),
            bg_color: hexColor,
            text_color: hexColor
        })
    ).query(async ({ input, ctx }) => {
        try {
            const result = await conn
                .insertInto('group')
                .values({
                    ...input,
                    family_id: ctx.family_id
                })
                .execute();
            return {
                status: true,
                data: Number(result[0].insertId!)
            } satisfies ResponseWithData<number>;
        } catch (err) {
            console.error(err);
            return {
                status: false,
                code: 500,
                message: 'Něco se nepovedlo na serveru :('
            } satisfies ErrorApiResponse;
        }
    }),
    groupProcedure.DELETE.input(z.number()).query(async ({ input, ctx }) => {
        try {
            const existing = await conn
                .selectFrom('group')
                .select('id')
                .where('id', '=', input)
                .where('family_id', '=', ctx.family_id)
                .executeTakeFirst();

            if (!existing) {
                return {
                    status: false,
                    code: 404,
                    message: 'groups.notFound' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }

            await conn.transaction().execute(async (trx) => {
                await trx
                    .deleteFrom('group_permissions')
                    .where('group_id', '=', input)
                    .execute();
                await trx
                    .deleteFrom('user_group')
                    .where('group_id', '=', input)
                    .execute();
                await trx
                    .deleteFrom('group')
                    .where('id', '=', input)
                    .where('family_id', '=', ctx.family_id)
                    .execute();
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
    }),
    groupProcedure.PATCH.input(
        z.object({
            id: z.number(),
            name: z.string(),
            bg_color: hexColor,
            text_color: hexColor
        })
    ).query(async ({ input, ctx }) => {
        try {
            const existing = await conn
                .selectFrom('group')
                .select('id')
                .where('id', '=', input.id)
                .where('family_id', '=', ctx.family_id)
                .executeTakeFirst();

            if (!existing) {
                return {
                    status: false,
                    code: 404,
                    message: 'groups.notFound' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }

            await conn
                .updateTable('group')
                .set({
                    name: input.name,
                    bg_color: input.bg_color,
                    text_color: input.text_color
                })
                .where('id', '=', input.id)
                .where('family_id', '=', ctx.family_id)
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
