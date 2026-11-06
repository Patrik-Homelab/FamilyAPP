import { conn } from '$/lib/server/variables';
import type { PageServerLoad } from './$types';

export const load = (async ({ parent }) => {
    const parentData = await parent();
    if (!parentData.userState.logged) return;
    const subscribed = await conn
        .selectFrom('enabled_temp_notifications')
        .selectAll()
        .where('userId', '=', parentData.userState.data.id)
        .executeTakeFirst();

    return {
        subscribed: subscribed !== undefined
    };
}) satisfies PageServerLoad;
