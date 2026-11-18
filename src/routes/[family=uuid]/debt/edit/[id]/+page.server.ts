import { getCookieData } from '$/lib/server/functions';
import { conn } from '$/lib/server/variables';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ cookies, params, parent }) => {
    const parentData = await parent();

    const data = getCookieData(cookies);
    if (!data.logged) redirect(302, '/');

    const id = parseInt(params.id);
    if (isNaN(id)) redirect(302, `/${params.family}/debt`);

    //check if the user is the owner of the debt within the same family
    const found = await conn
        .selectFrom('debt')
        .selectAll()
        .where((eb) =>
            eb.and([
                eb('debt.id', '=', id),
                eb('debt.whom', '=', data.data.id),
                eb('debt.family_id', '=', data.data.family_id)
            ])
        )
        .executeTakeFirst();
    if (!found) {
        redirect(302, `/${params.family}/debt`);
    }

    return {
        data: found,
        users: parentData.users
    };
}) satisfies PageServerLoad;
