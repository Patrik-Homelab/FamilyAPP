import type { PageServerLoad } from './$types';

export const load = (async ({ parent }) => {
    const parentData = await parent();

    return {
        users: parentData.users
    };
}) satisfies PageServerLoad;
