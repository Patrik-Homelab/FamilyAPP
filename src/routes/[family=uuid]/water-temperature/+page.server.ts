import { Permissions } from '$/lib/permissions';
import { conn } from '$/lib/server/variables';
import type { PageServerLoad } from './$types';

export const load = (async ({ parent }) => {
    const parentData = await parent();
    if (!parentData.userState.logged) {
        return {
            subscribed: false,
            haEnabled: false,
            canConfigureFamily: false
        };
    }

    const subscribed = await conn
        .selectFrom('enabled_temp_notifications')
        .selectAll()
        .where('userId', '=', parentData.userState.data.id)
        .executeTakeFirst();

    const perms = new Permissions(parentData.userState.data);

    return {
        subscribed: subscribed !== undefined,
        haEnabled: parentData.haEnabled,
        canConfigureFamily:
            perms.hasPermission('admin.family') || parentData.isFamilyOwner
    };
}) satisfies PageServerLoad;
