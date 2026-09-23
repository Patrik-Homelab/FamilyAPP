/*eslint-disable @typescript-eslint/no-explicit-any*/

import { Kysely } from 'kysely';

export const up = async (conn: Kysely<any>) => {
    await conn.schema
        .createTable('route')
        .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
        .addColumn('user_id', 'integer', (col) =>
            col.notNull().references('user.id').onDelete('cascade')
        )
        .addColumn('day', 'integer', (col) => col.notNull()) // 0=Mon, 6=Sun
        .addColumn('direction', 'varchar(10)', (col) => col.notNull()) // 'morning' | 'evening'
        .execute();

    await conn.schema
        .createTable('route_segment')
        .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
        .addColumn('route_id', 'integer', (col) =>
            col.notNull().references('route.id').onDelete('cascade')
        )
        .addColumn('position', 'integer', (col) => col.notNull()) // ordering index
        .addColumn('transport_type', 'varchar(10)', (col) => col.notNull()) // 'bus' | 'car'
        .addColumn('start_time', 'integer') // for car: minutes from midnight
        .addColumn('end_time', 'integer') // for car: minutes from midnight
        .addColumn('start_station', 'varchar(100)') // for bus
        .addColumn('end_station', 'varchar(100)') // for bus
        .execute();
};

export const down = async (conn: Kysely<any>) => {
    await conn.schema.dropTable('route_segment').execute();
    await conn.schema.dropTable('route').execute();
};
