import type { Response } from '$/types/types';
import type { ErrorApiResponse } from '@patrick115/sveltekitapi';
import { z } from 'zod';
import { loggedProcedure } from '../../../api';
import { conn } from '../../../variables';

const segmentSchema = z
    .object({
        position: z.number().int().min(0),
        transport_type: z.enum(['bus', 'car']),
        start_time: z.number().int().min(0).max(1439).nullable().optional(),
        end_time: z.number().int().min(0).max(1439).nullable().optional(),
        start_station: z.string().max(100).nullable().optional(),
        end_station: z.string().max(100).nullable().optional()
    })
    .refine(
        (seg) =>
            seg.transport_type !== 'car' ||
            (seg.start_time != null && seg.end_time != null),
        { message: 'Car segments must have start_time and end_time' }
    )
    .refine(
        (seg) =>
            seg.transport_type !== 'bus' ||
            (seg.start_station != null &&
                seg.start_station.length > 0 &&
                seg.end_station != null &&
                seg.end_station.length > 0),
        { message: 'Bus segments must have start_station and end_station' }
    );

export default [
    // PUT: Upsert a route with all its segments for a given day/direction
    loggedProcedure.PUT.input(
        z.object({
            day: z.number().min(0).max(6),
            direction: z.enum(['morning', 'evening']),
            segments: z.array(segmentSchema)
        })
    ).query(async ({ input, ctx }) => {
        try {
            // Find or create the route record
            const existing = await conn
                .selectFrom('route')
                .select('id')
                .where('user_id', '=', ctx.id)
                .where('day', '=', input.day)
                .where('direction', '=', input.direction)
                .executeTakeFirst();

            let routeId: number;

            if (existing) {
                routeId = existing.id;
                // Remove all existing segments – we will re-insert them
                await conn
                    .deleteFrom('route_segment')
                    .where('route_id', '=', routeId)
                    .execute();
            } else {
                const inserted = await conn
                    .insertInto('route')
                    .values({
                        user_id: ctx.id,
                        day: input.day,
                        direction: input.direction
                    })
                    .executeTakeFirstOrThrow();

                routeId = Number(inserted.insertId);
            }

            // Insert segments if any
            if (input.segments.length > 0) {
                await conn
                    .insertInto('route_segment')
                    .values(
                        input.segments.map((seg) => ({
                            route_id: routeId,
                            position: seg.position,
                            transport_type: seg.transport_type,
                            start_time: seg.start_time ?? null,
                            end_time: seg.end_time ?? null,
                            start_station: seg.start_station ?? null,
                            end_station: seg.end_station ?? null
                        }))
                    )
                    .execute();
            }

            return { status: true } satisfies Response;
        } catch (e) {
            console.error(e);
            return {
                status: false,
                code: 500,
                message: 'Internal Server Error'
            } satisfies ErrorApiResponse;
        }
    }),

    // DELETE: Remove a route (and its segments via cascade) for a given day/direction
    loggedProcedure.DELETE.input(
        z.object({
            day: z.number().min(0).max(6),
            direction: z.enum(['morning', 'evening'])
        })
    ).query(async ({ input, ctx }) => {
        try {
            await conn
                .deleteFrom('route')
                .where('user_id', '=', ctx.id)
                .where('day', '=', input.day)
                .where('direction', '=', input.direction)
                .execute();

            return { status: true } satisfies Response;
        } catch (e) {
            console.error(e);
            return {
                status: false,
                code: 500,
                message: 'Internal Server Error'
            } satisfies ErrorApiResponse;
        }
    })
];
