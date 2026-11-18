import { Server } from '$/lib/server/server';
import type { PageServerLoad } from './$types';

export const load = (async (ev) => {
    return {
        settings: await Server.ssr.family.settings.GET(ev)
    };
}) satisfies PageServerLoad;
