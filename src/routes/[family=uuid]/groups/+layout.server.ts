import { Permissions } from '$/lib/permissions';
import { getCookieData } from '$/lib/server/functions';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from '../$types';
import { logged } from '$/lib/state.svelte';
import { GROUP_PERMISSION } from '$/lib/server/routes/groups';

export const load = (async (ev) => {
    const userState = getCookieData(ev.cookies);
    if (!userState || !logged(userState)) {
        redirect(302, '/');
    }

    const permissions = new Permissions(userState.data);
    if (!permissions.hasPermission(GROUP_PERMISSION)) {
        redirect(302, '/');
    }
}) satisfies LayoutServerLoad;
