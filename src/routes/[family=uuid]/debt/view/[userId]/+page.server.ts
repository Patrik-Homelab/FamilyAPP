import { getCookieData } from '$/lib/server/functions';
import { getDebtsByUserId } from '$/lib/server/routes/debt';
import { conn } from '$/lib/server/variables';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ cookies, params }) => {
    const data = getCookieData(cookies);
    if (!data.logged) redirect(302, '/');

    const userId = parseInt(params.userId);
    if (isNaN(userId)) redirect(302, `/${params.family}/debt`);

    //check if the user is the owner of the debt within the same family
    const records = await getDebtsByUserId(userId, data.data.id, data.data.family_id);
    if (records.length === 0) {
        redirect(302, `/${params.family}/debt`);
    }

    const userInfo = await conn
        .selectFrom('user')
        .select([
            'id',
            'firstname',
            'lastname',
            'bank_account_prefix',
            'bank_account_number',
            'bank_code'
        ])
        .where('id', '=', userId)
        .where('family_id', '=', data.data.family_id)
        .executeTakeFirst();

    if (!userInfo) {
        redirect(302, `/${params.family}/debt`);
    }

    return {
        data: records,
        userInfo
    };
}) satisfies PageServerLoad;
