import z from 'zod';
import { loggedProcedure } from '../../api';
import { haWaterTemp } from '../../homeAssistant/waterTemp';

export default loggedProcedure.POST.input(
    z.object({
        year: z.number(),
        month: z.number(),
        day: z.number()
    })
).query(async ({ input }) => {
    const [lower, upper] = await haWaterTemp.getWaterTempDay(
        input.year,
        input.month,
        input.day
    );

    return {
        status: true,
        data: {
            lower: lower || [],
            upper: upper || []
        }
    };
});
