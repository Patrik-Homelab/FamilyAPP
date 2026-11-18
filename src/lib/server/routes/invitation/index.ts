import type { ErrorList } from '$/lib/errors';
import type { ResponseWithData, UserData } from '$/types/types';
import { HASH_ROUNDS } from '$env/static/private';
import type { ErrorApiResponse } from '@patrick115/sveltekitapi';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { z } from 'zod';
import { procedure } from '../../api';
import { getUserFamilyContext, setSessionCookie } from '../../functions';
import { conn } from '../../variables';
import { userProcedure } from '../users';

export default [
    userProcedure.GET.query(async ({ ctx }) => {
        const code = crypto.randomBytes(5).toString('hex');

        try {
            await conn
                .insertInto('invitation')
                .values({
                    code,
                    user_id: ctx.id,
                    family_id: ctx.family_id
                })
                .execute();

            return {
                status: true,
                data: code
            } satisfies ResponseWithData<string>;
        } catch (err) {
            console.error(err);
            return {
                status: false,
                code: 500,
                message: ''
            } satisfies ErrorApiResponse;
        }
    }),
    procedure.POST.input(
        z.object({
            username: z.string().trim().min(1),
            firstname: z.string().trim().min(1),
            lastname: z.string().trim().min(1),
            password: z.string().trim().min(1),
            code: z.string()
        })
    ).query(async ({ input, ev: { cookies } }) => {
        const invitation = await conn
            .selectFrom('invitation')
            .innerJoin('family', 'family.id', 'invitation.family_id')
            .select([
                'invitation.id as invitation_id',
                'invitation.family_id',
                'family.default_group_id'
            ])
            .where('invitation.code', '=', input.code)
            .executeTakeFirst();
        if (!invitation) {
            return {
                status: false,
                code: 401,
                message: 'invitation.code' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        const user = await conn
            .selectFrom('user')
            .select('id')
            .where('username', '=', input.username)
            .executeTakeFirst();

        if (user) {
            return {
                status: false,
                code: 401,
                message: 'auth.register.username' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }

        const hashed = bcrypt.hashSync(input.password, parseInt(HASH_ROUNDS));

        try {
            const newUserId = await conn.transaction().execute(async (trx) => {
                const del = await trx
                    .deleteFrom('invitation')
                    .where('id', '=', invitation.invitation_id)
                    .executeTakeFirst();
                if (del.numDeletedRows === 0n) {
                    throw new Error('INVITATION_ALREADY_USED');
                }

                const inserted = await trx
                    .insertInto('user')
                    .values({
                        family_id: invitation.family_id,
                        username: input.username,
                        firstname: input.firstname,
                        lastname: input.lastname,
                        password: hashed
                    })
                    .executeTakeFirstOrThrow();

                const userId = Number(inserted.insertId);

                if (invitation.default_group_id) {
                    const validGroup = await trx
                        .selectFrom('group')
                        .select('id')
                        .where('id', '=', invitation.default_group_id)
                        .where('family_id', '=', invitation.family_id)
                        .executeTakeFirst();

                    if (validGroup) {
                        await trx
                            .insertInto('user_group')
                            .values({
                                user_id: userId,
                                group_id: validGroup.id
                            })
                            .execute();
                    }
                }

                return userId;
            });

            const userData = await getUserFamilyContext(newUserId);
            if (!userData) {
                return {
                    status: false,
                    code: 500,
                    message: 'server.error' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }

            setSessionCookie(cookies, userData);

            return {
                status: true,
                data: userData
            } satisfies ResponseWithData<UserData>;
        } catch (err) {
            if (err instanceof Error && err.message === 'INVITATION_ALREADY_USED') {
                return {
                    status: false,
                    code: 401,
                    message: 'invitation.code' satisfies ErrorList
                } satisfies ErrorApiResponse;
            }
            console.error(err);
            return {
                status: false,
                code: 500,
                message: 'Něco se nepovedlo na serveru :('
            } satisfies ErrorApiResponse;
        }
    })
];
