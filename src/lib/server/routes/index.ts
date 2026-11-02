import { router } from '../api';
import auth from './auth';
import calendar from './calendar';
import debt from './debt';
import groups from './groups';
import invitation from './invitation';
import notifications from './notifications';
import permissions from './permissions';
import presents from './presents';
import push from './push';
import shoppinglist from './shoppinglist';
import timetable from './timetable';
import users from './users';

export const r = router({
    auth,
    permissions,
    groups,
    users,
    invitation,
    debt,
    push,
    calendar,
    presents,
    shoppinglist,
    timetable,
    notifications
});

export type AppRouter = typeof r;
