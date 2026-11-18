import type { ErrorList } from '$/lib/errors';
import type { ResponseWithData } from '$/types/types';
import type { ErrorApiResponse } from '@patrick115/sveltekitapi';
import { z } from 'zod';
import { procedure } from '../../api';
import { conn } from '../../variables';

export type LookupCodeResult = {
    type: 'invitation' | 'join_code';
    code: string;
    familyName: string;
    inviterName?: string;
};

export default procedure.POST.input(
    z.object({
        code: z.string().trim().min(1)
    })
).query(async ({ input }) => {
    const code = input.code.trim();

    const invitation = await conn
        .selectFrom('invitation')
        .innerJoin('family', 'family.id', 'invitation.family_id')
        .innerJoin('user', 'user.id', 'invitation.user_id')
        .select([
            'invitation.code',
            'family.name as family_name',
            'user.firstname',
            'user.lastname'
        ])
        .where('invitation.code', '=', code)
        .executeTakeFirst();

    if (invitation) {
        return {
            status: true,
            data: {
                type: 'invitation',
                code: invitation.code,
                familyName: invitation.family_name,
                inviterName: `${invitation.firstname} ${invitation.lastname}`
            }
        } satisfies ResponseWithData<LookupCodeResult>;
    }

    const family = await conn
        .selectFrom('family')
        .select(['join_code', 'name'])
        .where('join_code', '=', code.toUpperCase())
        .where('allow_join_code', '=', 1)
        .executeTakeFirst();

    if (family) {
        return {
            status: true,
            data: {
                type: 'join_code',
                code: family.join_code,
                familyName: family.name
            }
        } satisfies ResponseWithData<LookupCodeResult>;
    }

    return {
        status: false,
        code: 404,
        message: 'family.invalidJoinCode' satisfies ErrorList
    } satisfies ErrorApiResponse;
});
