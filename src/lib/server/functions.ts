import type { WebPush } from '$/types/database';
import type { UserData, UserState } from '$/types/types';
import { COOKIE_EXPIRE, FILE_FOLDER } from '$env/static/private';
import type { Awaitable } from '@patrick115/sveltekitapi';
import type { Cookies } from '@sveltejs/kit';
import type { Selectable } from 'kysely';
import * as cron from 'node-cron';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { default as Path } from 'node:path';
import webPush from 'web-push';
import { z } from 'zod';
import { conn, jwt } from './variables';

export const setSessionCookie = (cookies: Cookies, userData: UserData) => {
    const cookie = jwt.setCookie(userData);
    cookies.set('session', cookie, {
        path: '/',
        maxAge: parseInt(COOKIE_EXPIRE)
    });
};

export const getCookieData = (cookies: Cookies): UserState => {
    const cookie = cookies.get('session');
    if (!cookie) {
        return {
            logged: false
        };
    }

    const data = jwt.getCookie<UserData>(cookie);

    if (
        !data ||
        typeof data.family_id !== 'number' ||
        typeof data.family_uuid !== 'string' ||
        data.family_uuid.length === 0
    ) {
        return {
            logged: false
        };
    }

    return {
        logged: true,
        data
    };
};

export const getUserPermissions = async (id: number) => {
    const groupRel = await conn
        .selectFrom('user_group')
        .select('group_id')
        .where('user_id', '=', id)
        .executeTakeFirst();
    if (!groupRel) {
        return {
            group: undefined,
            permissions: [] as string[]
        };
    }

    const perms = await conn
        .selectFrom('group_permissions')
        .select('permission')
        .where('group_id', '=', groupRel.group_id)
        .execute();
    const group = await conn
        .selectFrom('group')
        .selectAll()
        .where('group.id', '=', groupRel.group_id)
        .executeTakeFirst();

    return {
        group: group!,
        permissions: perms.map((p) => p.permission)
    };
};

export const getUserFamilyContext = async (userId: number) => {
    const row = await conn
        .selectFrom('user')
        .innerJoin('family', 'family.id', 'user.family_id')
        .leftJoin('family_ha_config', 'family_ha_config.family_id', 'family.id')
        .select([
            'user.id',
            'user.username',
            'user.firstname',
            'user.lastname',
            'user.family_id',
            'user.bank_account_prefix',
            'user.bank_account_number',
            'user.bank_code',
            'family.uuid as family_uuid',
            'family.name as family_name',
            'family_ha_config.enabled as ha_enabled'
        ])
        .where('user.id', '=', userId)
        .executeTakeFirst();

    if (!row) return null;

    const perms = await getUserPermissions(userId);

    const userData: UserData = {
        id: row.id,
        username: row.username,
        firstname: row.firstname,
        lastname: row.lastname,
        family_id: row.family_id,
        bank_account_prefix: row.bank_account_prefix,
        bank_account_number: row.bank_account_number,
        bank_code: row.bank_code,
        family_uuid: row.family_uuid,
        family_name: row.family_name,
        ha_enabled: row.ha_enabled === 1,
        ...perms
    };

    return userData;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const hexColor = z.custom<string>((data: any) => {
    if (typeof data !== 'string') return false;
    if (data === null || data === undefined) return false;

    if (data.length !== 4 && data.length !== 7) return false;
    if (data[0] !== '#') return false;

    const isHexDigit = (char: string) => '0123456789abcdef'.split('').includes(char);

    return !data
        .toLowerCase()
        .substring(1)
        .split('')
        .some((ch) => !isHexDigit(ch));
});

type NotificationPayload = {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    actions?: {
        action: string;
        title: string;
    }[];
    timestamp?: number;
    priority?: 'high' | 'normal' | 'low';
    tag?: string;
    silent?: boolean;
    data?: Record<string, unknown>;
};

export const sendSingleNotification = async (
    payload: string,
    push: Selectable<WebPush>
) => {
    const obj = {
        endpoint: push.endpoint,
        keys: {
            p256dh: push.p256dh,
            auth: push.auth
        }
    };

    try {
        await webPush.sendNotification(obj, payload);
    } catch (e) {
        if (e !== null && typeof e === 'object' && 'statusCode' in e)
            if (e.statusCode === 410) {
                return false;
            }
    }
};

export const batchNotifications = async (
    notification: NotificationPayload,
    pushes: Selectable<WebPush>[]
) => {
    const payload = JSON.stringify({
        icon: '/icons/favicon-196x196.png',
        badge: '/icons/favicon-196x196.png',
        timestamp: Date.now(),
        silent: false,
        ...notification
    });

    const promises = pushes.map((push) => sendSingleNotification(payload, push));
    const results = await Promise.all(promises);

    const removeIds = results
        .map((result, idx) => {
            if (result === false) {
                return pushes[idx].id;
            }
            return false;
        })
        .filter((id) => id !== false);

    if (removeIds.length === 0) return;

    await conn.deleteFrom('web_push').where('id', 'in', removeIds).execute();
};

export const sendNotification = async (
    userId: number,
    notification: NotificationPayload
) => {
    const pushes = await conn
        .selectFrom('web_push')
        .selectAll()
        .where('userId', '=', userId)
        .execute();

    await batchNotifications(notification, pushes);
};

export const sendNotificationToMultiple = async (
    userIds: number[],
    notification: NotificationPayload
) => {
    if (userIds.length === 0) return;

    const pushes = await conn
        .selectFrom('web_push')
        .selectAll()
        .where('userId', 'in', userIds)
        .execute();

    await batchNotifications(notification, pushes);
};

export const sendNotificationToFamily = async (
    familyId: number,
    notification: NotificationPayload
) => {
    const pushes = await conn
        .selectFrom('web_push')
        .innerJoin('user', 'user.id', 'web_push.userId')
        .selectAll('web_push')
        .where('user.family_id', '=', familyId)
        .execute();

    await batchNotifications(notification, pushes);
};

export const asyncExists = async (path: string): Promise<boolean> => {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
};

export const uploadFile = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const path = Path.parse(file.name);
    const name = crypto.randomBytes(16).toString('hex') + path.ext;

    if (!(await asyncExists(FILE_FOLDER))) {
        await fs.mkdir(FILE_FOLDER);
    }

    await fs.writeFile(Path.join(FILE_FOLDER, name), Buffer.from(arrayBuffer));
    return name;
};

export type Cron =
    | [string, () => Awaitable<void>]
    | [string, () => Awaitable<void>, cron.TaskOptions];

/* eslint-disable no-console */
export const registerCrons = (crons: Cron[]) => {
    console.log('Registering crons...');

    for (const arr of crons) {
        cron.schedule(arr[0], arr[1], arr[2] ?? {});
    }

    console.log(`Registered ${crons.length} crons`);
};
/* eslint-enable no-console */
