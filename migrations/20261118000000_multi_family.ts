/*eslint-disable @typescript-eslint/no-explicit-any*/

import { Kysely, sql } from 'kysely';
import crypto from 'node:crypto';
import { encryptSecret } from '../src/lib/server/crypto';

const TENANT_TABLES = [
    'user',
    'group',
    'invitation',
    'calendar',
    'debt',
    'present',
    'shoppinglist'
] as const;

export const up = async (conn: Kysely<any>) => {
    // 1. Create `family`, `family_ha_config`, and `family_ha_sensor`
    await conn.schema
        .createTable('family')
        .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
        .addColumn('uuid', 'varchar(36)', (col) => col.notNull().unique())
        .addColumn('name', 'varchar(100)', (col) => col.notNull())
        .addColumn('join_code', 'varchar(16)', (col) => col.notNull().unique())
        .addColumn('allow_join_code', 'integer', (col) => col.notNull().defaultTo(1))
        .addColumn('owner_user_id', 'integer')
        .addColumn('default_group_id', 'integer')
        .addColumn('created_at', 'timestamp', (col) =>
            col.notNull().defaultTo(sql`current_timestamp()`)
        )
        .addForeignKeyConstraint(
            'fk_family_owner_user',
            ['owner_user_id'],
            'user',
            ['id'],
            (cb) => cb.onDelete('set null')
        )
        .addForeignKeyConstraint(
            'fk_family_default_group',
            ['default_group_id'],
            'group',
            ['id'],
            (cb) => cb.onDelete('set null')
        )
        .execute();

    await conn.schema
        .createTable('family_ha_config')
        .addColumn('family_id', 'integer', (col) => col.primaryKey())
        .addColumn('enabled', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('ha_url', 'varchar(255)', (col) => col.notNull().defaultTo(''))
        .addColumn('ha_token_encrypted', 'text', (col) => col.notNull())
        .addColumn('alerts_enabled', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('alert_sensor_id', 'integer')
        .addColumn('alert_min_temp', 'decimal(5, 2)', (col) =>
            col.notNull().defaultTo('30.00')
        )
        .addColumn('alert_max_temp', 'decimal(5, 2)', (col) =>
            col.notNull().defaultTo('75.00')
        )
        .addColumn('last_incident_state', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('last_incident_temp', 'decimal(5, 2)')
        .addColumn('last_incident_at', 'datetime')
        .addColumn('updated_at', 'timestamp', (col) =>
            col.notNull().defaultTo(sql`current_timestamp()`)
        )
        .addForeignKeyConstraint(
            'fk_family_ha_config_family',
            ['family_id'],
            'family',
            ['id'],
            (cb) => cb.onDelete('cascade')
        )
        .execute();

    await conn.schema
        .createTable('family_ha_sensor')
        .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
        .addColumn('family_id', 'integer', (col) => col.notNull())
        .addColumn('entity_id', 'varchar(255)', (col) => col.notNull())
        .addColumn('label', 'varchar(100)', (col) => col.notNull())
        .addColumn('color', 'varchar(7)', (col) => col.notNull().defaultTo('#ef4444'))
        .addColumn('sort_order', 'integer', (col) => col.notNull().defaultTo(0))
        .addForeignKeyConstraint(
            'fk_family_ha_sensor_family',
            ['family_id'],
            'family',
            ['id'],
            (cb) => cb.onDelete('cascade')
        )
        .execute();

    // 2. Add nullable family_id column to all tenant-scoped tables
    for (const table of TENANT_TABLES) {
        await conn.schema.alterTable(table).addColumn('family_id', 'integer').execute();
    }

    // 3. Backfill existing production/dev data into a single default family
    const existingUsers = await conn
        .selectFrom('user')
        .select('id')
        .orderBy('id', 'asc')
        .execute();

    const existingGroups = await conn
        .selectFrom('group')
        .select('id')
        .orderBy('id', 'asc')
        .execute();

    if (existingUsers.length > 0 || existingGroups.length > 0) {
        // Identify current admin user via group_permissions ('admin.users' or 'admin.groups')
        const adminPermRows = await conn
            .selectFrom('group_permissions')
            .select(['group_id', 'permission'])
            .where('permission', 'in', ['admin.users', 'admin.groups'])
            .execute();

        const adminGroupIds = [...new Set(adminPermRows.map((r) => r.group_id))];

        let ownerUserId: number | null = existingUsers[0]?.id ?? null;
        if (adminGroupIds.length > 0) {
            const adminUser = await conn
                .selectFrom('user_group')
                .select('user_id')
                .where('group_id', 'in', adminGroupIds)
                .orderBy('user_id', 'asc')
                .executeTakeFirst();

            if (adminUser) {
                ownerUserId = adminUser.user_id;
            }
        }

        // Pick first non-admin group as default_group_id if one exists
        const nonAdminGroup = existingGroups.find((g) => !adminGroupIds.includes(g.id));

        const familyInsert = await conn
            .insertInto('family')
            .values({
                uuid: crypto.randomUUID(),
                name: 'Moje rodina',
                join_code: crypto.randomBytes(4).toString('hex').toUpperCase(),
                allow_join_code: 1,
                owner_user_id: ownerUserId,
                default_group_id: nonAdminGroup?.id ?? null
            })
            .executeTakeFirstOrThrow();

        const defaultFamilyId = Number(familyInsert.insertId);

        for (const table of TENANT_TABLES) {
            await conn.updateTable(table).set({ family_id: defaultFamilyId }).execute();
        }

        // Grant 'admin.family' permission to existing admin groups
        for (const groupId of adminGroupIds) {
            const existingPerm = await conn
                .selectFrom('group_permissions')
                .select('permission')
                .where('group_id', '=', groupId)
                .where('permission', '=', 'admin.family')
                .executeTakeFirst();

            if (!existingPerm) {
                await conn
                    .insertInto('group_permissions')
                    .values({
                        group_id: groupId,
                        permission: 'admin.family'
                    })
                    .execute();
            }
        }

        // Migrate .env Home Assistant config into DB for the migrated family if present
        const haUrl = process.env.HOME_ASSISTANT_URL?.trim().replace(/\/+$/, '');
        const haToken = process.env.HOME_ASSISTANT_TOKEN?.trim();

        if (haUrl && haToken) {
            const downEntity = process.env.HA_WATER_DOWN_ENTITY?.trim();
            const upEntity = process.env.HA_WATER_UP_ENTITY?.trim();

            await conn
                .insertInto('family_ha_config')
                .values({
                    family_id: defaultFamilyId,
                    enabled: 1,
                    ha_url: haUrl,
                    ha_token_encrypted: encryptSecret(haToken),
                    alerts_enabled: upEntity || downEntity ? 1 : 0,
                    alert_sensor_id: null,
                    alert_min_temp: '30.00',
                    alert_max_temp: '75.00',
                    last_incident_state: 0
                })
                .execute();

            let alertSensorId: number | null = null;
            let sortOrder = 0;

            if (downEntity) {
                const downInsert = await conn
                    .insertInto('family_ha_sensor')
                    .values({
                        family_id: defaultFamilyId,
                        entity_id: downEntity,
                        label: 'Voda dole',
                        color: '#3b82f6',
                        sort_order: sortOrder++
                    })
                    .executeTakeFirstOrThrow();
                alertSensorId = Number(downInsert.insertId);
            }

            if (upEntity) {
                const upInsert = await conn
                    .insertInto('family_ha_sensor')
                    .values({
                        family_id: defaultFamilyId,
                        entity_id: upEntity,
                        label: 'Voda nahoře',
                        color: '#ef4444',
                        sort_order: sortOrder++
                    })
                    .executeTakeFirstOrThrow();
                // Prefer upper sensor for alerts to match legacy checkWaterTemp behavior
                alertSensorId = Number(upInsert.insertId);
            }

            if (alertSensorId !== null) {
                await conn
                    .updateTable('family_ha_config')
                    .set({ alert_sensor_id: alertSensorId })
                    .where('family_id', '=', defaultFamilyId)
                    .execute();
            }
        }
    }

    // 4. Enforce NOT NULL, indexes, and foreign keys on all tenant tables
    for (const table of TENANT_TABLES) {
        await conn.schema
            .alterTable(table)
            .modifyColumn('family_id', 'integer', (col) => col.notNull())
            .execute();

        await conn.schema
            .createIndex(`idx_${table}_family_id`)
            .on(table)
            .column('family_id')
            .execute();

        await conn.schema
            .alterTable(table)
            .addForeignKeyConstraint(
                `fk_${table}_family`,
                ['family_id'],
                'family',
                ['id'],
                (cb) => cb.onDelete('cascade')
            )
            .execute();
    }

    await conn.schema
        .alterTable('user')
        .addUniqueConstraint('uq_user_username', ['username'])
        .execute();

    await conn.schema
        .alterTable('invitation')
        .addUniqueConstraint('uq_invitation_code', ['code'])
        .execute();
};

const safeExec = async (fn: () => Promise<unknown>) => {
    try {
        await fn();
    } catch {
        // Ignore missing constraint/index/column during idempotent rollback
    }
};

export const down = async (conn: Kysely<any>) => {
    await safeExec(() =>
        sql.raw('ALTER TABLE `invitation` DROP INDEX `uq_invitation_code`').execute(conn)
    );
    await safeExec(() =>
        sql.raw('ALTER TABLE `user` DROP INDEX `uq_user_username`').execute(conn)
    );

    for (const table of [...TENANT_TABLES].reverse()) {
        await safeExec(() =>
            sql
                .raw(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`fk_${table}_family\``)
                .execute(conn)
        );
        await safeExec(() =>
            conn.schema.dropIndex(`idx_${table}_family_id`).on(table).execute()
        );
        await safeExec(() =>
            conn.schema.alterTable(table).dropColumn('family_id').execute()
        );
    }

    await conn
        .deleteFrom('group_permissions')
        .where('permission', '=', 'admin.family')
        .execute();

    await safeExec(() =>
        sql
            .raw('ALTER TABLE `family` DROP FOREIGN KEY `fk_family_owner_user`')
            .execute(conn)
    );
    await safeExec(() =>
        sql
            .raw('ALTER TABLE `family` DROP FOREIGN KEY `fk_family_default_group`')
            .execute(conn)
    );

    await conn.schema.dropTable('family_ha_sensor').ifExists().execute();
    await conn.schema.dropTable('family_ha_config').ifExists().execute();
    await conn.schema.dropTable('family').ifExists().execute();
};
