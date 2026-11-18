import { getCookieData } from '$/lib/server/functions';
import { conn } from '$/lib/server/variables';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ parent, cookies }) => {
    const userState = getCookieData(cookies);
    if (!userState.logged) redirect(302, '/');

    const parentData = await parent();

    const data = await conn
        .selectFrom('shoppinglist')
        .selectAll()
        .where('family_id', '=', userState.data.family_id)
        .execute();

    return {
        data,
        users: parentData.users
    };
}) satisfies PageServerLoad;
