import { getCookieData } from '$/lib/server/functions';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ cookies }) => {
    const data = getCookieData(cookies);
    if (!data.logged) redirect(302, '/');

    return {};
}) satisfies PageServerLoad;
