import { Permissions } from '$/lib/permissions';
import { getCookieData } from '$/lib/server/functions';
import { FAMILY_PERMISSION } from '$/lib/server/routes/family/settings';
import { conn } from '$/lib/server/variables';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load = (async (ev) => {
    const userState = getCookieData(ev.cookies);
    if (!userState.logged) {
        redirect(302, '/');
    }

    const permissions = new Permissions(userState.data);
    if (permissions.hasPermission(FAMILY_PERMISSION)) {
        return;
    }

    const family = await conn
        .selectFrom('family')
        .select('owner_user_id')
        .where('id', '=', userState.data.family_id)
        .executeTakeFirst();

    if (family?.owner_user_id !== userState.data.id) {
        redirect(302, `/${ev.params.family}`);
    }
}) satisfies LayoutServerLoad;
