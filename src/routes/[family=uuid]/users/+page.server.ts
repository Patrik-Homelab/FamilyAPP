import { getCookieData } from '$/lib/server/functions';
import { Server } from '$/lib/server/server';
import { conn } from '$/lib/server/variables';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async (ev) => {
    const userState = getCookieData(ev.cookies);
    if (!userState.logged) redirect(302, '/');

    return {
        users: await Server.ssr.users.GET(ev),
        groups: await conn
            .selectFrom('group')
            .selectAll()
            .where('family_id', '=', userState.data.family_id)
            .execute()
    };
}) satisfies PageServerLoad;
