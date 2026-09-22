import { z } from 'zod';
import { loggedProcedure } from '../../api';
import { FormDataInput, type ErrorApiResponse } from '@patrick115/sveltekitapi';
import type { ErrorList } from '$/lib/errors';
import { FILE_FOLDER, MAX_FILE_SIZE } from '$env/static/private';
import { uploadFile } from '../../functions';
import type { Response, ResponseWithData } from '$/types/types';
import { conn } from '../../variables';
import fs from 'node:fs';
import Path from 'node:path';
import bought from './bought';
import clone from './clone';

const presentSchema = z.object({
    name: z.string(),
    description: z.string().nullable(),
    link: z.string().nullable(),
    price: z.coerce.number().min(0, 'debt.negative' satisfies ErrorList)
});

export default [
    loggedProcedure.PUT.input(FormDataInput).query(async ({ input, ctx }) => {
        if (
            !input.has('name') ||
            !input.has('description') ||
            !input.has('link') ||
            !input.has('price')
        ) {
            return {
                status: false,
                code: 401,
                message: 'presents.input' satisfies ErrorList
            };
        }

        const data = presentSchema.safeParse({
            name: input.get('name'),
            description: input.get('description') || null,
            link: input.get('link') || null,
            price: input.get('price')
        });

        if (!data.success) {
            return {
                status: false,
                code: 401,
                message: 'presents.input' satisfies ErrorList
            };
        }

        const file = input.get('image');

        let fileName: string | undefined = undefined;

        if (file) {
            if (typeof file === 'string') {
                return {
                    status: false,
                    code: 401,
                    message: 'presents.file' satisfies ErrorList
                };
            }

            if (file.size > parseInt(MAX_FILE_SIZE)) {
                return {
                    status: false,
                    code: 401,
                    message: 'presents.size' satisfies ErrorList
                };
            }

            fileName = await uploadFile(file);
        }

        try {
            await conn
                .insertInto('present')
                .values({
                    user_id: ctx.id,
                    image: fileName,
                    ...data.data
                })
                .execute();

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
                            message: 'presents.range' satisfies ErrorList
                        } satisfies ErrorApiResponse;
                    }
                }
            }

            console.error(err);
            return {
                status: false,
                code: 500,
                message: 'Něco se nepovedlo na serveru'
            } satisfies ErrorApiResponse;
        }
    }),
    loggedProcedure.PATCH.input(
        z.object({
            id: z.number(),
            toState: z.literal(0).or(z.literal(1)).or(z.literal(2)) // 0 - we want to untaken it, 1 - taken, 2 - given
        })
    ).query(async ({ input, ctx }) => {
        const present = await conn
            .selectFrom('present')
            .selectAll()
            .where('id', '=', input.id)
            .executeTakeFirst();
        if (!present) {
            return {
                status: false,
                code: 401,
                message: 'presents.notFound' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        if (present.user_id === ctx.id) {
            return {
                status: false,
                code: 401,
                message: 'presents.own' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        //Possible states
        // 0 -> 1 We want to take package, but we need to check, if it's not already taken (eg state != 0)
        // 1 -> 0 We want to untake package, but we need to check, if we are the one who took it (eg reserved_id == ctx.id)
        // 1 -> 2 We want to complete package, but we need to check, if we are the one who took it (eg reserved_id == ctx.id)
        // 2 -> 1 We want to uncomplete package, but we need to check, if we are the one who completed it (eg reserved_id == ctx.id)
        // and error will be presents.input

        if (input.toState === 1) {
            //so if present is in state 2 we wan't it to downgrade to state 1 then we need to check if we are the one who completed it
            if (present.state === 2 && present.reserved_id !== ctx.id) {
                return {
                    status: false,
                    code: 401,
                    message: 'presents.input' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }
            //if present is in state 1 we wan't it to stay in state 1
            if (present.state === 1) {
                return {
                    status: false,
                    code: 401,
                    message: 'presents.other' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }
        }

        if (input.toState === 0) {
            //if present is in state 0 we wan't it to stay in state 0
            if (present.state === 0) {
                return {
                    status: false,
                    code: 401,
                    message: 'presents.input' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }
            //if present is in state 1 we wan't it to downgrade to state 0 then we need to check if we are the one who took it
            if (present.state === 1 && present.reserved_id !== ctx.id) {
                return {
                    status: false,
                    code: 401,
                    message: 'presents.input' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }
            //if present is in state 2, we can't skip state 1, so this is invalid
            if (present.state === 2) {
                return {
                    status: false,
                    code: 401,
                    message: 'presents.input' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }
        }

        if (input.toState === 2) {
            //if present is in state 0 we can't skip state 1, so this is invalid
            if (present.state === 0) {
                return {
                    status: false,
                    code: 401,
                    message: 'presents.input' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }
            //if present is in state 1 we wan't it to upgrade to state 2 then we need to check if we are the one who took it
            if (present.state === 1 && present.reserved_id !== ctx.id) {
                return {
                    status: false,
                    code: 401,
                    message: 'presents.input' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }
            //if present is in state 2 we wan't it to stay in state 2
            if (present.state === 2) {
                return {
                    status: false,
                    code: 401,
                    message: 'presents.input' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }
        }

        try {
            await conn
                .updateTable('present')
                .set({
                    state: input.toState,
                    reserved_id: input.toState === 0 ? null : ctx.id,
                    // Reset bought to 0 when unclaiming (state 0), undefined keeps the current value
                    bought: input.toState === 0 ? 0 : undefined
                })
                .where('id', '=', input.id)
                .execute();

            const newData = await conn
                .selectFrom('present')
                .selectAll()
                .where('id', '=', input.id)
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
                message: 'Něco se nepovedlo na serveru'
            } satisfies ErrorApiResponse;
        }
    }),
    loggedProcedure.DELETE.input(z.number()).query(async ({ input, ctx }) => {
        try {
            await conn
                .deleteFrom('present')
                .where((eb) => eb.and([eb('id', '=', input), eb('user_id', '=', ctx.id)]))
                .execute();
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
    loggedProcedure.POST.input(FormDataInput).query(async ({ input, ctx }) => {
        if (!input.has('id')) {
            return {
                status: false,
                code: 401,
                message: 'presents.input' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        const schema = presentSchema.partial().extend({
            id: z.coerce.number()
        });

        const data = schema.safeParse({
            id: input.get('id'),
            // empty string needs to be converted to null, because it means, that user didn't input anything
            // but null means, that property is not presented, so it needs to be undefined, because we don't want to
            // update it in db
            name: input.get('name') === null ? undefined : input.get('name') || null,
            description:
                input.get('description') === null
                    ? undefined
                    : input.get('description') || null,
            link: input.get('link') === null ? undefined : input.get('link') || null,
            price: input.get('price') ?? undefined
        });

        if (!data.success) {
            return {
                status: false,
                code: 401,
                message: 'presents.input' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        //get current fileName
        const present = await conn
            .selectFrom('present')
            .select('image')
            .where((eb) =>
                eb.and([eb('id', '=', data.data.id), eb('user_id', '=', ctx.id)])
            )
            .executeTakeFirst();
        if (!present) {
            return {
                status: false,
                code: 401,
                message: 'debt.input' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        let fileName: string | null | undefined = undefined;

        //check if file is deleted, or added
        if (input.has('image')) {
            const file = input.get('image')!;

            if (typeof file === 'string') {
                if (file === 'deleted') {
                    if (present.image) {
                        fs.rmSync(Path.join(FILE_FOLDER, present.image));
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
            await conn
                .updateTable('present')
                .set({
                    ...data.data,
                    image: fileName,
                    price: data.data.price?.toString(),
                    updated_at: new Date()
                })
                .where('id', '=', data.data.id)
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
    // Sub-route for bought and clone endpoints
    {
        bought,
        clone
    }
];
