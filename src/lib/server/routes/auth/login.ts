import { z } from 'zod';
import { procedure } from '../../api';
import { conn } from '../../variables';
import type { ErrorApiResponse } from '@patrick115/sveltekitapi';
import bcrypt from 'bcrypt';
import type { ResponseWithData, UserData } from '$/types/types';
import type { ErrorList } from '$/lib/errors';
import { getUserFamilyContext, setSessionCookie } from '../../functions';

export default procedure.POST.input(
    z.object({
        username: z.string(),
        password: z.string()
    })
).query(async ({ input, ev: { cookies } }) => {
    const data = await conn
        .selectFrom('user')
        .select(['id', 'password'])
        .where('username', '=', input.username)
        .executeTakeFirst();
    if (!data) {
        return {
            status: false,
            code: 400,
            message: 'auth.login.username' satisfies ErrorList
        } satisfies ErrorApiResponse;
    }

    if (!bcrypt.compareSync(input.password, data.password)) {
        return {
            status: false,
            code: 400,
            message: 'auth.login.password' satisfies ErrorList
        } satisfies ErrorApiResponse;
    }

    const userData = await getUserFamilyContext(data.id);
    if (!userData) {
        return {
            status: false,
            code: 400,
            message: 'auth.login.username' satisfies ErrorList
        } satisfies ErrorApiResponse;
    }

    setSessionCookie(cookies, userData);

    return {
        status: true,
        data: userData
    } satisfies ResponseWithData<UserData>;
});
