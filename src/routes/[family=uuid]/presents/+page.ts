import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load = (({ params }) => {
    redirect(302, `/${params.family}/presents/mine`);
}) satisfies PageLoad;
