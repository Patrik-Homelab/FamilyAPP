import { Server } from '$/lib/server/server';
import type { PageServerLoad } from './$types';

export const load = (async (ev) => {
    return {
        groups: await Server.ssr.groups.GET(ev)
    };
}) satisfies PageServerLoad;
