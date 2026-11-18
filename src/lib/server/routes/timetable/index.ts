import type { DailyRoutine, TimetableEntry } from '$/types/database';
import type { Response, ResponseWithData } from '$/types/types';
import type { ErrorApiResponse } from '@patrick115/sveltekitapi';
import type { Selectable } from 'kysely';
import { z } from 'zod';
import { loggedProcedure } from '../../api';
import { conn } from '../../variables';

export default [
    // GET: List all users who have timetable entries (or just all users to be safe?)
    // Let's just return all users so we can switch to anyone easily.
    loggedProcedure.GET.query(async ({ ctx }) => {
        try {
            // Get users in the same family who have at least one timetable entry
            const users = await conn
                .selectFrom('user')
                .innerJoin('timetable_entry', 'timetable_entry.user_id', 'user.id')
                .select(['user.id', 'user.username', 'user.firstname', 'user.lastname'])
                .where('user.family_id', '=', ctx.family_id)
                .distinct()
                .execute();

            return { status: true, data: users } satisfies ResponseWithData<typeof users>;
        } catch (e) {
            console.error(e);
            return {
                status: false,
                code: 500,
                message: 'Internal Server Error'
            } satisfies ErrorApiResponse;
        }
    }),

    // POST: Get timetable + routine for a specific user
    loggedProcedure.POST.input(
        z.object({
            userId: z.number().optional() // if undefined, use logged user
        })
    ).query(async ({ input, ctx }) => {
        try {
            const targetUserId = input.userId ?? ctx.id;

            if (targetUserId !== ctx.id) {
                const targetUser = await conn
                    .selectFrom('user')
                    .select('id')
                    .where('id', '=', targetUserId)
                    .where('family_id', '=', ctx.family_id)
                    .executeTakeFirst();

                if (!targetUser) {
                    return {
                        status: false,
                        code: 404,
                        message: 'Uživatel nenalezen'
                    } satisfies ErrorApiResponse;
                }
            }

            const timetable = await conn
                .selectFrom('timetable_entry')
                .selectAll()
                .where('user_id', '=', targetUserId)
                .execute();

            const routine = await conn
                .selectFrom('daily_routine')
                .selectAll()
                .where('user_id', '=', targetUserId)
                .execute();

            return {
                status: true,
                data: { timetable, routine, isMe: targetUserId === ctx.id }
            } satisfies ResponseWithData<{
                timetable: Selectable<TimetableEntry>[];
                routine: Selectable<DailyRoutine>[];
                isMe: boolean;
            }>;
        } catch (e) {
            console.error(e);
            return {
                status: false,
                code: 500,
                message: 'Internal Server Error'
            } satisfies ErrorApiResponse;
        }
    }),

    // PUT: Add or Edit a Timetable Entry
    // We will use upsert logic if ID is present, or insert if not.
    // Actually simpler to have separated INSERT and UPDATE, or just one generic Save.
    // Let's use PUT for UPSERT (if id is present -> update, else insert)
    loggedProcedure.PUT.input(
        z.object({
            id: z.number().optional(),
            day: z.number().min(0).max(6),
            start_min: z.number().min(0).max(1439),
            end_min: z.number().min(0).max(1439),
            title: z.string().min(1),
            type: z.enum(['lecture', 'practice']),
            subject: z.string().min(1),
            room: z.string().optional()
        })
    ).query(async ({ input, ctx }) => {
        try {
            // Check Overlap
            // Conflict if: (StartA < EndB) and (EndA > StartB)
            const overlap = await conn
                .selectFrom('timetable_entry')
                .select('id')
                .where('user_id', '=', ctx.id)
                .where('day', '=', input.day)
                .where((eb) =>
                    eb.and([
                        eb('start_min', '<', input.end_min),
                        eb('end_min', '>', input.start_min)
                    ])
                )
                .execute();

            // If we are updating, we must ignore our own id in overlap check
            const conflict = input.id
                ? overlap.filter((o) => o.id !== input.id).length > 0
                : overlap.length > 0;

            if (conflict) {
                return {
                    status: false,
                    code: 400,
                    message: 'Time overlap detected!'
                } satisfies ErrorApiResponse;
            }

            if (input.id) {
                await conn
                    .updateTable('timetable_entry')
                    .set({
                        day: input.day,
                        start_min: input.start_min,
                        end_min: input.end_min,
                        title: input.title,
                        type: input.type,
                        subject: input.subject,
                        room: input.room
                    })
                    .where('id', '=', input.id)
                    .where('user_id', '=', ctx.id) // Security: only own entries
                    .execute();
            } else {
                await conn
                    .insertInto('timetable_entry')
                    .values({
                        user_id: ctx.id,
                        day: input.day,
                        start_min: input.start_min,
                        end_min: input.end_min,
                        title: input.title,
                        type: input.type,
                        subject: input.subject,
                        room: input.room
                    })
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

    // DELETE: Remove entry
    loggedProcedure.DELETE.input(
        z.object({
            id: z.number()
        })
    ).query(async ({ input, ctx }) => {
        try {
            await conn
                .deleteFrom('timetable_entry')
                .where('id', '=', input.id)
                .where('user_id', '=', ctx.id)
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
    }),

    // PATCH: Upsert Daily Routine
    loggedProcedure.PATCH.input(
        z.object({
            day: z.number().min(0).max(6),
            wake_time: z.number().nullable().optional(),
            transport_morning_type: z.enum(['bus', 'car']).nullable().optional(),
            transport_morning_time: z.number().nullable().optional(),
            transport_evening_type: z.enum(['bus', 'car']).nullable().optional(),
            transport_evening_time: z.number().nullable().optional(),
            home_arrival_time: z.number().nullable().optional()
        })
    ).query(async ({ input, ctx }) => {
        try {
            // Check if routine exists for this day
            const existing = await conn
                .selectFrom('daily_routine')
                .select('id')
                .where('user_id', '=', ctx.id)
                .where('day', '=', input.day)
                .executeTakeFirst();

            if (existing) {
                await conn
                    .updateTable('daily_routine')
                    .set({
                        wake_time: input.wake_time,
                        transport_morning_type: input.transport_morning_type,
                        transport_morning_time: input.transport_morning_time,
                        transport_evening_type: input.transport_evening_type,
                        transport_evening_time: input.transport_evening_time,
                        home_arrival_time: input.home_arrival_time
                    })
                    .where('id', '=', existing.id)
                    .execute();
            } else {
                await conn
                    .insertInto('daily_routine')
                    .values({
                        user_id: ctx.id,
                        day: input.day,
                        wake_time: input.wake_time,
                        transport_morning_type: input.transport_morning_type,
                        transport_morning_time: input.transport_morning_time,
                        transport_evening_type: input.transport_evening_type,
                        transport_evening_time: input.transport_evening_time,
                        home_arrival_time: input.home_arrival_time
                    })
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
    })
];
