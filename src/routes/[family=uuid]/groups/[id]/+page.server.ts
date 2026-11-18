import { getCookieData } from '$/lib/server/functions';
import { conn } from '$/lib/server/variables';
import type { Group } from '$/types/database';
import { redirect } from '@sveltejs/kit';
import type { Selectable } from 'kysely';
import type { PageServerLoad } from './$types';

export const load = (async ({ params, cookies }) => {
    const userState = getCookieData(cookies);
    if (!userState.logged) redirect(302, '/');

    const id = parseInt(params.id);
    if (isNaN(id)) redirect(302, `/${params.family}/groups`);

    const group = await conn
        .selectFrom('group')
        .selectAll()
        .where('id', '=', id)
        .where('family_id', '=', userState.data.family_id)
        .executeTakeFirst();

    if (!group) redirect(302, `/${params.family}/groups`);

    const perms = await conn
        .selectFrom('group_permissions')
        .select('permission')
        .where('group_id', '=', id)
        .execute();

    const groupData: Selectable<Group> & { permissions: string[] } = {
        ...group,
        permissions: perms.map((p) => p.permission)
    };

    return {
        groupData
    };
}) satisfies PageServerLoad;
