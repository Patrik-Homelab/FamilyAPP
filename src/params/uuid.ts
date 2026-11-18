import type { ParamMatcher } from '@sveltejs/kit';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const match = ((param: string) => {
    return UUID_REGEX.test(param);
}) satisfies ParamMatcher;
