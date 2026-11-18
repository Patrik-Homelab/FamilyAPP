import { Permissions } from '$/lib/permissions';
import { getCookieData } from '$/lib/server/functions';
import { NOTIFICATION_PERMISSION } from '$/lib/server/routes/notifications';
import { logged } from '$/lib/state.svelte';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load = (async (ev) => {
    const userState = getCookieData(ev.cookies);
    if (!userState || !logged(userState)) {
        redirect(302, '/');
    }

    const permissions = new Permissions(userState.data);
    if (!permissions.hasPermission(NOTIFICATION_PERMISSION)) {
        redirect(302, '/');
    }
}) satisfies LayoutServerLoad;
