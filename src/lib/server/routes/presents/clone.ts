import { z } from 'zod';
import { loggedProcedure } from '../../api';
import { type ErrorApiResponse } from '@patrick115/sveltekitapi';
import type { ErrorList } from '$/lib/errors';
import type { ResponseWithData } from '$/types/types';
import { conn } from '../../variables';
import { FILE_FOLDER } from '$env/static/private';
import { asyncExists } from '../../functions';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import Path from 'node:path';

export default loggedProcedure.POST.input(
    z.object({
        id: z.number()
    })
).query(async ({ input, ctx }) => {
    const present = await conn
        .selectFrom('present')
        .selectAll()
        .where('id', '=', input.id)
        .executeTakeFirst();

    if (!present) {
        return {
            status: false,
            code: 404,
            message: 'presents.notFound' satisfies ErrorList
        } satisfies ErrorApiResponse;
    }

    try {
        let newImage: string | null = null;

        if (present.image) {
            const srcPath = Path.join(FILE_FOLDER, present.image);
            if (await asyncExists(srcPath)) {
                if (!(await asyncExists(FILE_FOLDER))) {
                    await fs.mkdir(FILE_FOLDER, { recursive: true });
                }
                const ext = Path.parse(present.image).ext;
                const newFileName = crypto.randomBytes(16).toString('hex') + ext;
                await fs.copyFile(srcPath, Path.join(FILE_FOLDER, newFileName));
                newImage = newFileName;
            }
        }

        const result = await conn
            .insertInto('present')
            .values({
                user_id: ctx.id,
                name: present.name,
                description: present.description,
                link: present.link,
                price: present.price,
                image: newImage,
                state: 0,
                bought: 0,
                reserved_id: null
            })
            .execute();

        const newId = Number(result[0].insertId!);

        return {
            status: true,
            data: {
                id: newId
            }
        } satisfies ResponseWithData<{ id: number }>;
    } catch (err) {
        console.error(err);
        return {
            status: false,
            code: 500,
            message: 'server.error' satisfies ErrorList
        } satisfies ErrorApiResponse;
    }
});
