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

const DEFAULT_ADMIN_PERMISSIONS = [
    'admin.family',
    'admin.groups',
    'admin.users',
    'admin.notifications'
] as const;

export default procedure.POST.input(
    z.object({
        familyName: z.string().trim().min(1).max(100),
        username: z.string().trim().min(1).max(50),
        firstname: z.string().trim().min(1).max(50),
        lastname: z.string().trim().min(1).max(50),
        password: z.string().trim().min(1)
    })
).query(async ({ input, ev: { cookies } }) => {
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

    const hashedPassword = bcrypt.hashSync(input.password, parseInt(HASH_ROUNDS));

    try {
        const createdUserId = await conn.transaction().execute(async (trx) => {
            const familyInsert = await trx
                .insertInto('family')
                .values({
                    uuid: crypto.randomUUID(),
                    name: input.familyName,
                    join_code: crypto.randomBytes(4).toString('hex').toUpperCase(),
                    allow_join_code: 1
                })
                .executeTakeFirstOrThrow();

            const familyId = Number(familyInsert.insertId);

            // Seed default Admin and Member groups for this family
            const adminGroupInsert = await trx
                .insertInto('group')
                .values({
                    family_id: familyId,
                    name: 'Admin',
                    bg_color: '#dc2626',
                    text_color: '#ffffff'
                })
                .executeTakeFirstOrThrow();
            const adminGroupId = Number(adminGroupInsert.insertId);

            await trx
                .insertInto('group_permissions')
                .values(
                    DEFAULT_ADMIN_PERMISSIONS.map((permission) => ({
                        group_id: adminGroupId,
                        permission
                    }))
                )
                .execute();

            const memberGroupInsert = await trx
                .insertInto('group')
                .values({
                    family_id: familyId,
                    name: 'Člen',
                    bg_color: '#2563eb',
                    text_color: '#ffffff'
                })
                .executeTakeFirstOrThrow();
            const memberGroupId = Number(memberGroupInsert.insertId);

            const userInsert = await trx
                .insertInto('user')
                .values({
                    family_id: familyId,
                    username: input.username,
                    firstname: input.firstname,
                    lastname: input.lastname,
                    password: hashedPassword
                })
                .executeTakeFirstOrThrow();
            const userId = Number(userInsert.insertId);

            await trx
                .updateTable('family')
                .set({
                    owner_user_id: userId,
                    default_group_id: memberGroupId
                })
                .where('id', '=', familyId)
                .execute();

            await trx
                .insertInto('user_group')
                .values({
                    user_id: userId,
                    group_id: adminGroupId
                })
                .execute();

            return userId;
        });

        const userData = await getUserFamilyContext(createdUserId);
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
        console.error('Failed to create family:', err);
        return {
            status: false,
            code: 500,
            message: 'server.error' satisfies ErrorList
        } satisfies ErrorApiResponse;
    }
});
