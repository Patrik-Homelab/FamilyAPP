import type { ErrorList } from '$/lib/errors';
import type { ResponseWithData, UserData } from '$/types/types';
import { HASH_ROUNDS } from '$env/static/private';
import type { ErrorApiResponse } from '@patrick115/sveltekitapi';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { procedure } from '../../api';
import { getUserFamilyContext, setSessionCookie } from '../../functions';
import { conn } from '../../variables';

export default procedure.POST.input(
    z.object({
        code: z.string().trim().min(1),
        username: z.string().trim().min(1).max(50),
        firstname: z.string().trim().min(1).max(50),
        lastname: z.string().trim().min(1).max(50),
        password: z.string().trim().min(1)
    })
).query(async ({ input, ev: { cookies } }) => {
    const code = input.code.trim();

    const invitation = await conn
        .selectFrom('invitation')
        .innerJoin('family', 'family.id', 'invitation.family_id')
        .select([
            'invitation.id as invitation_id',
            'family.id as family_id',
            'family.default_group_id'
        ])
        .where('invitation.code', '=', code)
        .executeTakeFirst();

    const familyMatch = invitation
        ? null
        : await conn
              .selectFrom('family')
              .select(['id as family_id', 'default_group_id'])
              .where('join_code', '=', code.toUpperCase())
              .where('allow_join_code', '=', 1)
              .executeTakeFirst();

    const target = invitation ?? familyMatch;
    if (!target) {
        return {
            status: false,
            code: 404,
            message: 'family.invalidJoinCode' satisfies ErrorList
        } satisfies ErrorApiResponse;
    }

    const existingUser = await conn
        .selectFrom('user')
        .select('id')
        .where('username', '=', input.username)
        .executeTakeFirst();

    if (existingUser) {
        return {
            status: false,
            code: 400,
            message: 'auth.register.username' satisfies ErrorList
        } satisfies ErrorApiResponse;
    }

    const hashed = bcrypt.hashSync(input.password, parseInt(HASH_ROUNDS));

    try {
        const newUserId = await conn.transaction().execute(async (trx) => {
            if (invitation) {
                const del = await trx
                    .deleteFrom('invitation')
                    .where('id', '=', invitation.invitation_id)
                    .executeTakeFirst();
                if (del.numDeletedRows === 0n) {
                    throw new Error('INVITATION_ALREADY_USED');
                }
            }

            const userInsert = await trx
                .insertInto('user')
                .values({
                    family_id: target.family_id,
                    username: input.username,
                    firstname: input.firstname,
                    lastname: input.lastname,
                    password: hashed
                })
                .executeTakeFirstOrThrow();

            const userId = Number(userInsert.insertId);

            if (target.default_group_id) {
                const validGroup = await trx
                    .selectFrom('group')
                    .select('id')
                    .where('id', '=', target.default_group_id)
                    .where('family_id', '=', target.family_id)
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
                code: 400,
                message: 'invitation.code' satisfies ErrorList
            } satisfies ErrorApiResponse;
        }
        console.error('Failed to join family:', err);
        return {
            status: false,
            code: 500,
            message: 'server.error' satisfies ErrorList
        } satisfies ErrorApiResponse;
    }
});
