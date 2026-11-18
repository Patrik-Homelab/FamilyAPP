import { conn } from '$/lib/server/variables';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ params, parent }) => {
    const invitation = await conn
        .selectFrom('invitation')
        .select('code')
        .where('code', '=', params.code)
        .executeTakeFirst();

    if (invitation) {
        redirect(302, `/invitation/${encodeURIComponent(invitation.code)}`);
    }

    const family = await conn
        .selectFrom('family')
        .select(['name', 'join_code'])
        .where('join_code', '=', params.code.toUpperCase())
        .where('allow_join_code', '=', 1)
        .executeTakeFirst();

    if (!family) {
        redirect(302, '/');
    }

    const parentData = await parent();

    return {
        familyName: family.name,
        code: family.join_code,
        version: parentData.version
    };
}) satisfies PageServerLoad;
