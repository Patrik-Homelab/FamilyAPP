import type { UserData, UserState } from '$/types/types';
import { getContext, setContext } from 'svelte';

type State = {
    userState: UserState;
    title: string;
    pushEnabled: boolean;
};

let state = $state<State>();

export const setState = (_state: State) => {
    state = _state;
    setContext('state', state);
};

export const getState = () => {
    return getContext<State>('state');
};

export const logged = (state: UserState): state is { logged: true; data: UserData } => {
    return state.logged;
};
