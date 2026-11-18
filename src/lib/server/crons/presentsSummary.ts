import { PresentState } from '$/types/types';
import { sendNotification, type Cron } from '../functions';
import { conn } from '../variables';

/**
 * Daily presents summary cron job
 * Runs every day at 20:00 (8 PM)
 * Sends a notification to each user with a summary of presents changes from the past day
 * within their own family:
 * - New presents added by other users (potential gift ideas)
 * - Presents edited by other users
 */
export default [
    '0 0 20 * * *',
    async () => {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Get all users with their family UUID
        const users = await conn
            .selectFrom('user')
            .innerJoin('family', 'family.id', 'user.family_id')
            .select([
                'user.id',
                'user.firstname',
                'user.family_id',
                'family.uuid as family_uuid'
            ])
            .execute();

        // Get all new presents added in the past day (excluding already given ones)
        const allNewPresents = await conn
            .selectFrom('present')
            .innerJoin('user', 'user.id', 'present.user_id')
            .select([
                'present.id',
                'present.name',
                'present.user_id',
                'present.family_id',
                'user.firstname as owner_firstname'
            ])
            .where('present.created_at', '>=', oneDayAgo)
            .where('present.state', '!=', PresentState.GIVEN)
            .execute();

        // Get all presents edited in the past day (excluding already given ones)
        const allEditedPresents = await conn
            .selectFrom('present')
            .innerJoin('user', 'user.id', 'present.user_id')
            .select([
                'present.id',
                'present.name',
                'present.user_id',
                'present.family_id',
                'present.created_at',
                'user.firstname as owner_firstname'
            ])
            .where('present.updated_at', 'is not', null)
            .where('present.updated_at', '>=', oneDayAgo)
            .where('present.state', '!=', PresentState.GIVEN)
            .execute();

        for (const user of users) {
            // Filter new presents for this user within the same family
            const newPresents = allNewPresents.filter(
                (p) => p.family_id === user.family_id && p.user_id !== user.id
            );

            // Filter edited presents for this user within the same family
            const editedPresents = allEditedPresents.filter(
                (p) =>
                    p.family_id === user.family_id &&
                    p.user_id !== user.id &&
                    p.created_at < oneDayAgo
            );

            // Skip if no changes
            if (newPresents.length === 0 && editedPresents.length === 0) {
                continue;
            }

            // Build notification message
            const messageParts: string[] = [];

            if (newPresents.length > 0) {
                const uniqueOwners = [
                    ...new Set(newPresents.map((p) => p.owner_firstname))
                ];
                messageParts.push(
                    `${newPresents.length} nových přání od: ${uniqueOwners.join(', ')}`
                );
            }

            if (editedPresents.length > 0) {
                const uniqueOwners = [
                    ...new Set(editedPresents.map((p) => p.owner_firstname))
                ];
                messageParts.push(
                    `${editedPresents.length} upravených přání od: ${uniqueOwners.join(', ')}`
                );
            }

            await sendNotification(user.id, {
                title: 'Denní přehled přání',
                body: messageParts.join('. '),
                data: {
                    url: `/${user.family_uuid}/presents/others`
                }
            });
        }
    }
] satisfies Cron;
