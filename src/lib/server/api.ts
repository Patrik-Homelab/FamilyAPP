import { APICreate, MiddleWareError } from '@patrick115/sveltekitapi';
import type { Context } from './context';
import { Permissions, type Permission } from '../permissions';
import { env } from '$env/dynamic/private';

export const api = new APICreate<Context>();

export const router = api.router;
export const procedure = api.procedure;
export const loggedProcedure = procedure.use(async ({ ctx, next }) => {
    if (!ctx.logged) {
        throw new MiddleWareError({
            status: false,
            code: 401,
            message: 'Unauthorized'
        });
    }

    return next(ctx.data);
});

export const permProcedure = (permissions: Permission[]) => {
    return loggedProcedure.use(async ({ ctx, next }) => {
        const perms = new Permissions(ctx);

        if (!permissions.some((p) => perms.hasPermission(p))) {
            throw new MiddleWareError({
                status: false,
                code: 401,
                message: "You don't have permission to do that"
            });
        }

        return next();
    });
};

export const protectedProcedure = procedure.use(async ({ ev, next }) => {
    const secret = ev.url.searchParams.get('SECRET');
    const apiSecret = env.API_SECRET || process.env.API_SECRET;

    if (!secret || !apiSecret || secret !== apiSecret) {
        throw new MiddleWareError({
            status: false,
            code: 401,
            message: 'Invalid or missing API secret'
        });
    }

    return next();
});
