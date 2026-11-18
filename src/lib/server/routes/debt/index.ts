import { z } from 'zod';
import { loggedProcedure } from '../../api';
import { FormDataInput, type ErrorApiResponse } from '@patrick115/sveltekitapi';
import fs from 'node:fs';
import Path from 'node:path';
import type { ErrorList } from '$/lib/errors';
import { FILE_FOLDER, MAX_FILE_SIZE } from '$env/static/private';
import { conn } from '../../variables';
import type { DePromise, Response, ResponseWithData } from '$/types/types';
import { sendNotification, uploadFile } from '../../functions';
import { formatUser, toDate } from '$/lib/functions';

export const getDebtsByUserId = async (userId: number, who: number, familyId: number) => {
    return await conn
        .selectFrom('debt')
        .selectAll()
        .where((eb) =>
            eb.and([
                eb('debt.family_id', '=', familyId),
                eb('debt.whom', '=', userId),
                eb('debt.who', '=', who),
                eb('resolved_on', 'is', null)
            ])
        )
        .orderBy('when', 'desc')
        .execute();
};

const debtSchema = z.object({
    who: z.coerce.number(),
    amount: z.coerce.number().min(0, 'debt.negative' satisfies ErrorList),
    when: z.string()
});

export default [
    loggedProcedure.PUT.input(FormDataInput).query(async ({ input, ctx }) => {
        if (!input.has('who') || !input.has('amount') || !input.has('when')) {
            return {
                status: false,
                code: 401,
                message: 'debt.input' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        const data = debtSchema.safeParse({
            who: input.get('who'),
            amount: input.get('amount'),
            when: input.get('when')
        });

        if (!data.success) {
            return {
                status: false,
                code: 401,
                message: 'debt.input' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        const targetUser = await conn
            .selectFrom('user')
            .select('id')
            .where('id', '=', data.data.who)
            .where('family_id', '=', ctx.family_id)
            .executeTakeFirst();

        if (!targetUser) {
            return {
                status: false,
                code: 401,
                message: 'debt.input' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        let fileName: string | undefined = undefined;
        //handle file
        if (input.has('image')) {
            const file = input.get('image')!;
            if (typeof file === 'string') {
                return {
                    status: false,
                    code: 401,
                    message: 'debt.file' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }

            if (file.size > parseInt(MAX_FILE_SIZE)) {
                return {
                    status: false,
                    code: 401,
                    message: 'debt.size' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }

            fileName = await uploadFile(file);
        }

        try {
            await conn
                .insertInto('debt')
                .values({
                    family_id: ctx.family_id,
                    who: data.data.who,
                    whom: ctx.id,
                    price: data.data.amount,
                    photo: fileName,
                    when: new Date(data.data.when)
                })
                .execute();

            await sendNotification(data.data.who, {
                title: 'Máš nový dluh',
                body: `${formatUser(ctx)} chce po tobě ${data.data.amount} Kč`,
                data: {
                    url: `/${ctx.family_uuid}/debt/view/${ctx.id}`
                }
            });

            return {
                status: true
            } satisfies Response;
        } catch (err) {
            if (err instanceof Error) {
                if ('code' in err) {
                    if (err.code === 'ER_WARN_DATA_OUT_OF_RANGE') {
                        return {
                            status: false,
                            code: 401,
                            message: 'debt.range' satisfies ErrorList
                        } satisfies ErrorApiResponse;
                    }
                }
            }
            return {
                status: false,
                code: 500,
                message: 'Něco se nepovedlo na serveru'
            } satisfies ErrorApiResponse;
        }
    }),
    loggedProcedure.DELETE.input(z.number()).query(async ({ ctx, input }) => {
        try {
            await conn
                .deleteFrom('debt')
                .where((eb) =>
                    eb.and([
                        eb('id', '=', input),
                        eb('whom', '=', ctx.id),
                        eb('family_id', '=', ctx.family_id)
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
                message: ''
            } satisfies ErrorApiResponse;
        }
    }),
    loggedProcedure.PATCH.input(FormDataInput).query(async ({ input, ctx }) => {
        if (!input.has('id')) {
            return {
                status: false,
                code: 401,
                message: 'debt.input' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        const schema = debtSchema.partial().extend({
            id: z.coerce.number()
        });

        const data = schema.safeParse({
            id: input.get('id'),
            who: input.get('who') ?? undefined,
            amount: input.get('amount') ?? undefined,
            when: input.get('when') ?? undefined
        });

        if (!data.success) {
            return {
                status: false,
                code: 401,
                message: 'debt.input' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        //get current fileName
        const debt = await conn
            .selectFrom('debt')
            .select('photo')
            .where((eb) =>
                eb.and([
                    eb('id', '=', data.data.id),
                    eb('whom', '=', ctx.id),
                    eb('family_id', '=', ctx.family_id)
                ])
            )
            .executeTakeFirst();
        if (!debt) {
            return {
                status: false,
                code: 401,
                message: 'debt.input' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        if (data.data.who !== undefined) {
            const targetUser = await conn
                .selectFrom('user')
                .select('id')
                .where('id', '=', data.data.who)
                .where('family_id', '=', ctx.family_id)
                .executeTakeFirst();

            if (!targetUser) {
                return {
                    status: false,
                    code: 401,
                    message: 'debt.input' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }
        }

        let fileName: string | null | undefined = undefined;

        //check if file is deleted, or added
        if (input.has('image')) {
            const file = input.get('image')!;

            if (typeof file === 'string') {
                if (file === 'deleted') {
                    if (debt.photo) {
                        fs.rmSync(Path.join(FILE_FOLDER, debt.photo));
                        fileName = null;
                    }
                }
            } else {
                if (file.size > parseInt(MAX_FILE_SIZE)) {
                    return {
                        status: false,
                        code: 401,
                        message: 'debt.size' satisfies ErrorList
                    } satisfies ErrorApiResponse;
                }

                fileName = await uploadFile(file);
            }
        }

        try {
            //update data
            await conn
                .updateTable('debt')
                .set({
                    id: data.data.id,
                    who: data.data.who,
                    price: data.data.amount ? data.data.amount.toString() : undefined,
                    when: data.data.when ? new Date(data.data.when) : undefined,
                    photo: fileName
                })
                .where('id', '=', data.data.id)
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
                message: ''
            } satisfies ErrorApiResponse;
        }
    }),
    loggedProcedure.POST.input(
        z.object({
            whom: z.number(),
            ids: z.array(z.number())
        })
    ).query(async ({ input, ctx }) => {
        try {
            if (input.ids.length === 0) {
                return {
                    status: true,
                    data: await getDebtsByUserId(input.whom, ctx.id, ctx.family_id)
                } satisfies ResponseWithData<
                    DePromise<ReturnType<typeof getDebtsByUserId>>
                >;
            }

            await conn
                .updateTable('debt')
                .set({
                    resolved_on: new Date()
                })
                .where((eb) =>
                    eb.and([
                        eb('family_id', '=', ctx.family_id),
                        eb('whom', '=', input.whom),
                        eb('who', '=', ctx.id),
                        eb('id', 'in', input.ids)
                    ])
                )
                .execute();

            const list = await conn
                .selectFrom('debt')
                .selectAll()
                .where('family_id', '=', ctx.family_id)
                .where('id', 'in', input.ids)
                .orderBy('when', 'desc')
                .execute();

            let baseBody = `${formatUser(ctx)} ti splatil nějaké dluhy.`;

            for (const item of list) {
                baseBody += `\n- ${toDate(item.when)} - ${parseFloat(item.price)} Kč`;
            }

            await sendNotification(input.whom, {
                title: 'Byl ti splacen dluh',
                body: baseBody,
                data: {
                    url: `/${ctx.family_uuid}/debt`
                }
            });

            return {
                status: true,
                data: await getDebtsByUserId(input.whom, ctx.id, ctx.family_id)
            } satisfies ResponseWithData<DePromise<ReturnType<typeof getDebtsByUserId>>>;
        } catch (err) {
            console.error(err);
            return {
                status: false,
                code: 500,
                message: ''
            } satisfies ErrorApiResponse;
        }
    })
];
