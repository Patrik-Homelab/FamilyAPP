import { getCookieData } from '$/lib/server/functions';
import { conn } from '$/lib/server/variables';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load = (async ({ cookies, parent, params }) => {
    const userState = getCookieData(cookies);
    if (!userState.logged) {
        redirect(302, '/');
    }

    if (params.family !== userState.data.family_uuid) {
        redirect(302, `/${userState.data.family_uuid}`);
    }

    const parentData = await parent();
    const familyId = userState.data.family_id;

    const familyRow = await conn
        .selectFrom('family')
        .leftJoin('family_ha_config', 'family_ha_config.family_id', 'family.id')
        .select([
            'family.name',
            'family.owner_user_id',
            'family_ha_config.enabled as ha_enabled'
        ])
        .where('family.id', '=', familyId)
        .executeTakeFirst();

    if (!familyRow) {
        redirect(302, '/');
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const afterWeek = new Date(startOfDay);
    afterWeek.setDate(afterWeek.getDate() + 7);

    return {
        familyUuid: params.family,
        familyName: familyRow.name,
        haEnabled: familyRow.ha_enabled === 1,
        isFamilyOwner: familyRow.owner_user_id === userState.data.id,
        recentEvents: conn
            .selectFrom('calendar')
            .selectAll()
            .where('family_id', '=', familyId)
            .where((eb) =>
                eb.or([
                    eb.and([eb('to', '>=', startOfDay), eb('from', '<=', startOfDay)]),
                    eb.and([eb('from', '>=', startOfDay), eb('from', '<', afterWeek)])
                ])
            )
            .limit(5)
            .orderBy('from', 'asc')
            .execute()
            .then((events) =>
                events.map((event) => {
                    return {
                        ...event,
                        full_day: {
                            data: [event.full_day.at(0)] as [0 | 1]
                        }
                    };
                })
            ),
        users: await conn
            .selectFrom('user')
            .select(['id', 'username', 'firstname', 'lastname'])
            .where('family_id', '=', familyId)
            .execute(),
        version: parentData.version
    };
}) satisfies LayoutServerLoad;
