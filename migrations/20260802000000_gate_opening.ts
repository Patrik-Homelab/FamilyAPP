/*eslint-disable @typescript-eslint/no-explicit-any*/

import { Kysely, sql } from 'kysely';

export const up = async (conn: Kysely<any>) => {
    await conn.schema
        .createTable('gate_opening')
        .ifNotExists()
        .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
        .addColumn('group_id', 'integer', (col) =>
            col.notNull().references('group.id').onDelete('cascade')
        )
        .addColumn('uuid', 'varchar(36)', (col) => col.notNull().unique())
        .addColumn('created_by_user_id', 'integer', (col) =>
            col.notNull().references('user.id').onDelete('cascade')
        )
        .addColumn('description', 'varchar(255)', (col) => col.notNull())
        .addColumn('start_date', 'timestamp', (col) => col.notNull())
        .addColumn('end_date', 'timestamp')
        .addColumn('activation_count', 'integer', (col) => col.notNull())
        .addColumn('activations_used', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('created_at', 'timestamp', (col) =>
            col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
        )
        .addColumn('updated_at', 'timestamp', (col) =>
            col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
        )
        .execute();
};

export const down = async (conn: Kysely<any>) => {
    await conn.schema.dropTable('gate_opening').execute();
};
