import type { Selectable } from 'kysely';
import type { User, Group } from './database';

export type UserData = Omit<Selectable<User>, 'password'> & {
    family_uuid: string;
    family_name: string;
    ha_enabled: boolean;
    permissions: string[];
    group?: Selectable<Group>;
};

export type UserState =
    | {
          logged: false;
      }
    | {
          logged: true;
          data: UserData;
      };

export type Response = {
    status: true;
};

export type ResponseWithData<$DataType> = Response & {
    data: $DataType;
};

export type DePromise<$Promise> =
    $Promise extends Promise<infer $Type> ? $Type : $Promise;

export type DeArray<$Array> = $Array extends Array<infer $Type> ? $Type : $Array;

/**
 * Present states
 */
export enum PresentState {
    AVAILABLE = 0,
    RESERVED = 1,
    GIVEN = 2
}
