import { Server } from '$/lib/server/server';
import type { PageServerLoad } from './$types';

export const load = (async (ev) => {
    return {
        users: await Server.ssr.users.GET(ev)
    };
}) satisfies PageServerLoad;
