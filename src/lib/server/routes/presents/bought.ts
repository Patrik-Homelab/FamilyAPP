import { z } from 'zod';
import { loggedProcedure } from '../../api';
import { type ErrorApiResponse } from '@patrick115/sveltekitapi';
import type { ErrorList } from '$/lib/errors';
import type { ResponseWithData } from '$/types/types';
import { conn } from '../../variables';

export default loggedProcedure.PATCH.input(
    z.object({
        id: z.number(),
        bought: z.literal(0).or(z.literal(1))
    })
).query(async ({ input, ctx }) => {
    const present = await conn
        .selectFrom('present')
        .selectAll()
        .where('id', '=', input.id)
        .where('family_id', '=', ctx.family_id)
        .executeTakeFirst();

    if (!present) {
        return {
            status: false,
            code: 401,
            message: 'presents.notFound' satisfies ErrorList
        } satisfies ErrorApiResponse;
    }

    // Only the user who reserved the present can update bought status
    if (present.reserved_id !== ctx.id) {
        return {
            status: false,
            code: 401,
            message: 'presents.input' satisfies ErrorList
        } satisfies ErrorApiResponse;
    }

    // Present must be in reserved state (1) or completed state (2) to toggle bought
    if (present.state === 0) {
        return {
            status: false,
            code: 401,
            message: 'presents.input' satisfies ErrorList
        } satisfies ErrorApiResponse;
    }

    try {
        await conn
            .updateTable('present')
            .set({
                bought: input.bought
            })
            .where('id', '=', input.id)
            .where('family_id', '=', ctx.family_id)
            .execute();

        const newData = await conn
            .selectFrom('present')
            .selectAll()
            .where('id', '=', input.id)
            .where('family_id', '=', ctx.family_id)
            .executeTakeFirst();

        if (!newData) {
            return {
                status: false,
                code: 500,
                message: 'presents.notFound' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        return {
            status: true,
            data: newData
        } satisfies ResponseWithData<typeof newData>;
    } catch (err) {
        console.error(err);
        return {
            status: false,
            code: 500,
            message: 'server.error' satisfies ErrorList
        } satisfies ErrorApiResponse;
    }
});
