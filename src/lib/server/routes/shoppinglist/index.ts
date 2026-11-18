import { z } from 'zod';
import { loggedProcedure } from '../../api';
import { FormDataInput, type ErrorApiResponse } from '@patrick115/sveltekitapi';
import type { ErrorList } from '$/lib/errors';
import { MAX_FILE_SIZE } from '$env/static/private';
import { sendNotificationToFamily, uploadFile } from '../../functions';
import { conn } from '../../variables';
import type { Response } from '$/types/types';
import { formatUser } from '$/lib/functions';

export default [
    loggedProcedure.PUT.input(FormDataInput).query(async ({ input, ctx }) => {
        const schema = z.object({
            name: z.string(),
            count: z.string()
        });

        const data = {
            name: input.get('name'),
            count: input.get('count')
        };

        const parsed = schema.safeParse(data);

        if (!parsed.success) {
            return {
                status: false,
                code: 401,
                message: 'shoppinglist.input' satisfies ErrorList
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
                .insertInto('shoppinglist')
                .values({
                    family_id: ctx.family_id,
                    name: parsed.data.name,
                    count: parseInt(parsed.data.count),
                    image: fileName,
                    user_id: ctx.id
                })
                .execute();

            sendNotificationToFamily(ctx.family_id, {
                title: 'Nová položka na nákupním seznamu',
                body: `${formatUser(ctx)} přidal ${parsed.data.count}x ${parsed.data.name} na nákupní seznam.`,
                data: {
                    url: `/${ctx.family_uuid}/shoppinglist`
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
                message: 'Něco se nepovedlo na serveru'
            } satisfies ErrorApiResponse;
        }
    }),
    loggedProcedure.POST.input(z.array(z.number())).query(async ({ input, ctx }) => {
        try {
            if (input.length === 0) {
                return {
                    status: true
                } satisfies Response;
            }

            const items = await conn
                .selectFrom('shoppinglist')
                .selectAll()
                .where('id', 'in', input)
                .where('family_id', '=', ctx.family_id)
                .execute();
            if (items.length !== input.length) {
                return {
                    status: false,
                    code: 404,
                    message: 'shoppinglist.notFound' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }
            if (items.some((item) => item.bought_by !== null)) {
                return {
                    status: false,
                    code: 401,
                    message: 'shoppinglist.bought' satisfies ErrorList
                };
            }

            await conn
                .updateTable('shoppinglist')
                .set({ bought_by: ctx.id, bought_at: new Date() })
                .where('id', 'in', input)
                .where('family_id', '=', ctx.family_id)
                .execute();

            let body = `${formatUser(ctx)} zakoupil:`;

            for (const item of items) {
                body += `\n- ${item.count}x ${item.name}`;
            }

            sendNotificationToFamily(ctx.family_id, {
                title: 'Položka zakoupena',
                body,
                data: {
                    url: `/${ctx.family_uuid}/shoppinglist`
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
                message: 'Něco se nepovedlo na serveru'
            } satisfies ErrorApiResponse;
        }
    }),
    loggedProcedure.DELETE.input(z.number()).query(async ({ input, ctx }) => {
        try {
            const data = await conn
                .selectFrom('shoppinglist')
                .selectAll()
                .where('id', '=', input)
                .where('family_id', '=', ctx.family_id)
                .executeTakeFirst();

            if (!data) {
                return {
                    status: false,
                    code: 401,
                    message: 'shoppinglist.notFound' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }

            if (data.user_id !== ctx.id) {
                return {
                    status: false,
                    code: 401,
                    message: 'shoppinglist.author' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }

            await conn
                .deleteFrom('shoppinglist')
                .where('id', '=', input)
                .where('family_id', '=', ctx.family_id)
                .execute();

            sendNotificationToFamily(ctx.family_id, {
                title: 'Odstraněna položka z nákupního seznamu',
                body: `${formatUser(ctx)} odstranil ${data.count}x ${data.name} z nákupního seznamu.`,
                data: {
                    url: `/${ctx.family_uuid}/shoppinglist`
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
                message: 'Něco se nepovedlo na serveru'
            } satisfies ErrorApiResponse;
        }
    })
];
