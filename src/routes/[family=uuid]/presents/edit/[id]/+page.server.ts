import { getCookieData } from '$/lib/server/functions';
import { conn } from '$/lib/server/variables';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ params, cookies }) => {
    const id = parseInt(params.id);

    if (isNaN(id)) {
        redirect(302, `/${params.family}/presents/mine`);
    }

    const userState = getCookieData(cookies);

    if (!userState.logged) {
        redirect(302, '/');
    }

    const present = await conn
        .selectFrom('present')
        .selectAll()
        .where('id', '=', id)
        .where('family_id', '=', userState.data.family_id)
        .executeTakeFirst();

    if (!present) {
        redirect(302, `/${params.family}/presents/mine`);
    }

    if (present.user_id !== userState.data.id) {
        redirect(302, `/${params.family}/presents/mine`);
    }

    return {
        data: present
    };
}) satisfies PageServerLoad;
