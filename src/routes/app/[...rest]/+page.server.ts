import { getCookieData } from '$/lib/server/functions';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (({ cookies, params }) => {
    const userState = getCookieData(cookies);
    if (userState.logged) {
        const rest = params.rest ? `/${params.rest}` : '';
        redirect(302, `/${userState.data.family_uuid}${rest}`);
    }
    redirect(302, '/');
}) satisfies PageServerLoad;
