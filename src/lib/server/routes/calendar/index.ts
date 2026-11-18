import { z } from 'zod';
import { loggedProcedure } from '../../api';
import { conn } from '../../variables';
import type { ErrorApiResponse } from '@patrick115/sveltekitapi';
import type { ResponseWithData, Response } from '$/types/types';
import type { ErrorList } from '$/lib/errors';
import { sendNotificationToFamily } from '../../functions';
import { formatUser, toDate } from '$/lib/functions';

export default [
    loggedProcedure.POST.input(
        z.object({
            from: z.coerce.date(),
            to: z.coerce.date()
        })
    ).query(async ({ input, ctx }) => {
        try {
            const data = await conn
                .selectFrom('calendar')
                .selectAll()
                .where('family_id', '=', ctx.family_id)
                //we want to find all events, that start or end is in the range
                .where((eb) =>
                    eb.or([
                        eb.and([
                            eb('from', '>=', input.from),
                            eb('from', '<=', input.to)
                        ]),
                        eb.and([eb('to', '>=', input.from), eb('to', '<=', input.to)])
                    ])
                )
                .execute();

            return {
                status: true,
                data
            } satisfies ResponseWithData<typeof data>;
        } catch (err) {
            console.error(err);
            return {
                status: false,
                code: 500,
                message: ''
            } satisfies ErrorApiResponse;
        }
    }),
    loggedProcedure.PUT.input(
        z.object({
            name: z.string(),
            description: z.string().optional(),
            from: z.coerce.date(),
            to: z.coerce.date(),
            fullDay: z.boolean(),
            notification: z.boolean()
        })
    ).query(async ({ input, ctx }) => {
        if (input.from.getTime() > input.to.getTime()) {
            return {
                status: false,
                code: 400,
                message: 'calendar.date' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        try {
            await conn
                .insertInto('calendar')
                .values({
                    family_id: ctx.family_id,
                    name: input.name,
                    description: input.description,
                    from: input.from,
                    to: input.to,
                    full_day: Buffer.from([input.fullDay ? 1 : 0]),
                    user_id: ctx.id
                })
                .execute();

            if (input.notification) {
                let baseText = `${formatUser(ctx)} přidal novou událost: ${input.name} `;

                if (input.fullDay) {
                    baseText += `probíhající od ${toDate(input.from, true)} do ${toDate(input.to, true)}.`;
                } else {
                    baseText += `probíhající od ${toDate(input.from)} do ${toDate(input.to)}.`;
                }

                sendNotificationToFamily(ctx.family_id, {
                    title: 'Nová událost',
                    body: baseText,
                    data: {
                        url: `/${ctx.family_uuid}/calendar`
                    }
                });
            }

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
    loggedProcedure.DELETE.input(z.number()).query(async ({ input, ctx }) => {
        try {
            const event = await conn
                .selectFrom('calendar')
                .select('name')
                .where('id', '=', input)
                .where('family_id', '=', ctx.family_id)
                .executeTakeFirst();

            if (!event) {
                return {
                    status: false,
                    code: 401,
                    message: 'calendar.delete' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }

            const data = await conn
                .deleteFrom('calendar')
                .where('id', '=', input)
                .where('user_id', '=', ctx.id)
                .where('family_id', '=', ctx.family_id)
                .executeTakeFirst();

            if (data.numDeletedRows == 0n) {
                return {
                    status: false,
                    code: 401,
                    message: 'calendar.delete' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }

            sendNotificationToFamily(ctx.family_id, {
                title: 'Odstraněna událost',
                body: `${formatUser(ctx)} odstranil událost ${event.name}`,
                data: {
                    url: `/${ctx.family_uuid}/calendar`
                }
            });

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
    })
];
