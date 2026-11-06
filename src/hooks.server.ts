import * as cron from 'node-cron';
import checkWaterTemp from './lib/server/crons/checkWaterTemp';
import presentsSummary from './lib/server/crons/presentsSummary';
import { registerCrons } from './lib/server/functions';

if (process.cronsRegistered) {
    //destroy all existing tasks to avoid duplicates
    cron.getTasks().forEach((task) => task.destroy());
}

registerCrons([presentsSummary, checkWaterTemp]);
process.cronsRegistered = true;
