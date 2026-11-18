import { getCookieData } from '$/lib/server/functions';
import { conn } from '$/lib/server/variables';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ params, cookies, parent }) => {
    const parentData = await parent();

    const userData = getCookieData(cookies);

    if (!userData.logged) {
        redirect(302, '/');
    }

    let query = conn
        .selectFrom('present')
        .selectAll()
        .where('family_id', '=', userData.data.family_id)
        .where('user_id', params.page === 'mine' ? '=' : '!=', userData.data.id);

    if (params.page !== 'mine') {
        query = query.where('state', '!=', 2);
    }

    const data = await query.orderBy('state', 'asc').orderBy('id', 'desc').execute();

    return {
        data,
        users: parentData.users
    };
}) satisfies PageServerLoad;
