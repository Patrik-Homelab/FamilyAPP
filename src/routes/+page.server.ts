import { getCookieData } from '$/lib/server/functions';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (({ cookies }) => {
    const userState = getCookieData(cookies);
    if (userState.logged) {
        redirect(302, `/${userState.data.family_uuid}`);
    }
}) satisfies PageServerLoad;
