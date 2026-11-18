import { conn } from '$/lib/server/variables';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ params, parent }) => {
    const result = await conn
        .selectFrom('invitation')
        .innerJoin('user', 'user.id', 'invitation.user_id')
        .innerJoin('family', 'family.id', 'invitation.family_id')
        .select([
            'invitation.code',
            'user.firstname',
            'user.lastname',
            'family.name as family_name'
        ])
        .where('invitation.code', '=', params.code)
        .executeTakeFirst();

    if (!result) {
        redirect(302, '/');
    }

    const parentData = await parent();

    return {
        invitation: result,
        version: parentData.version
    };
}) satisfies PageServerLoad;
