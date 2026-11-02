/*eslint-disable @typescript-eslint/no-explicit-any*/

import { Kysely } from 'kysely';

export const up = async (conn: Kysely<any>) => {
    await conn.schema
        .alterTable('present')
        .modifyColumn('link', 'varchar(1024)')
        .execute();
};

export const down = async (conn: Kysely<any>) => {
    await conn.schema
        .alterTable('present')
        .modifyColumn('link', 'varchar(512)')
        .execute();
};
