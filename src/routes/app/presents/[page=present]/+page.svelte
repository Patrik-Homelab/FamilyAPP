<script lang="ts">
    import Icon from '$/components/Icon.svelte';
    import Image from '$/components/Image.svelte';
    import { API } from '$/lib/api';
    import { extractError } from '$/lib/errors';
    import { formatUser, SwalAlert } from '$/lib/functions';
    import { getState } from '$/lib/state.svelte';
    import type { Present as PresentDB } from '$/types/database';
    import { PresentState } from '$/types/types';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import type { Selectable } from 'kysely';
    import { untrack } from 'svelte';

    type Present = Selectable<PresentDB>;

    import type { PageProps } from './$types';

    const { data }: PageProps = $props();

    let presents = $state(data.data);

    let grouped = $state<Record<number, Present[]>>({});

    const _state = getState();
    const userState = _state.userState;

    let opened = $state<Record<number, boolean>>({});
    let minePage = $state(page.params.page === 'mine');

    $effect(() => {
        minePage = page.params.page === 'mine';

        untrack(() => {
            presents = data.data;
        });
    });

    $effect(() => {
        grouped = {};

        for (const present of presents) {
            if (userState.logged && userState.data.id === present.user_id) {
                continue; // skip my own presents
            }
            untrack(() => {
                if (!(present.user_id in grouped)) {
                    grouped[present.user_id] = [];
                }
                if (!(present.user_id in opened)) {
                    opened[present.user_id] = false;
                }
                grouped[present.user_id].push(present);
            });
        }
    });

    const states = $derived({
        [PresentState.AVAILABLE]: 'Volný',
        [PresentState.RESERVED]: minePage ? 'Volný' : 'Rezervovaný', // because we don't want to spoil the surprise
        [PresentState.GIVEN]: 'Předaný'
    });
    const stateColors = $derived({
        [PresentState.AVAILABLE]: 'text-green-500',
        [PresentState.RESERVED]: minePage ? 'text-green-500' : 'text-yellow-500',
        [PresentState.GIVEN]: 'text-red-500'
    });

    const UpdateStates = {
        [PresentState.AVAILABLE]: 'Dárek byl úspěšně vrácen',
        [PresentState.RESERVED]: 'Dárek byl úspěšně rezervován',
        [PresentState.GIVEN]: 'Dárek byl úspěšně předán'
    };

    const updateState = async (id: number, toState: 0 | 1 | 2) => {
        const response = await API.presents.PATCH({
            id,
            toState
        });

        if (!response.status) {
            SwalAlert({
                title: extractError(response.message),
                icon: 'error'
            });

            return;
        }

        const idx = presents.findIndex((present) => present.id === id)!;
        presents[idx] = response.data;

        SwalAlert({
            title: UpdateStates[toState],
            icon: 'success'
        });
    };

    const toggleBought = async (id: number, currentBought: number) => {
        const newBought = currentBought === 1 ? 0 : 1;
        const response = await API.presents.bought({
            id,
            bought: newBought as 0 | 1
        });

        if (!response.status) {
            SwalAlert({
                title: extractError(response.message),
                icon: 'error'
            });

            return;
        }

        const idx = presents.findIndex((present) => present.id === id);
        if (idx !== -1) {
            presents[idx] = response.data;
        }
    };

    const deletePresent = async (id: number) => {
        const confirmation = await SwalAlert({
            toast: false,
            position: 'center',
            timer: 0,
            title: 'Opravdu chceš smazat tento dárek?',
            showConfirmButton: true,
            confirmButtonText: 'Ano',
            showCancelButton: true,
            cancelButtonText: 'Ne'
        });

        if (!confirmation.isConfirmed) {
            return;
        }

        const response = await API.presents.DELETE(id);

        if (!response.status) {
            SwalAlert({
                title: extractError(response.message),
                icon: 'error'
            });

            return;
        }

        presents = presents.filter((present) => present.id !== id);

        SwalAlert({
            title: 'Dárek byl úspěšně smazán',
            icon: 'success'
        });
    };

    let isCloning = $state(false);

    const clonePresent = async (id: number) => {
        if (isCloning) return;
        isCloning = true;

        try {
            const response = await API.presents.clone({ id });

            if (!response.status) {
                SwalAlert({
                    title: extractError(response.message),
                    icon: 'error'
                });

                return;
            }

            await goto(`/app/presents/edit/${response.data.id}`);
        } finally {
            isCloning = false;
        }
    };
</script>

{#if userState.logged}
    {#snippet presentList(presents: Present[])}
        {#if presents.length === 0}
            <h1 class="font-poppins text-center text-xl font-bold">
                {#if page.params.page === 'mine'}Nemáš žádné dárky{:else}Nemá žádné dárky{/if}
            </h1>
        {:else}
            {#each presents as present (present.id)}
                <div class="border-text flex flex-row gap-2 rounded-md border-2 p-2">
                    <div class="flex w-1/4 items-center justify-center">
                        {#if present.image}
                            <a href="/images/{present.image}" target="_blank"
                                ><Image name={present.image} alt="" /></a
                            >
                        {:else}
                            <Icon name="bi-image" class="text-4xl" />
                        {/if}
                    </div>
                    <div class="flex w-full flex-col">
                        <div
                            class="border-b-text flex justify-between border-b-2 font-bold"
                        >
                            <h1>{present.name}</h1>
                            <span>{parseFloat(present.price)} Kč</span>
                        </div>
                        {#if present.description}
                            <span>{present.description}</span>
                        {/if}
                        <div class="mt-auto flex justify-between">
                            <span
                                >Stav: <span
                                    class={stateColors[present.state as 0 | 1 | 2]}
                                    >{states[present.state as 0 | 1 | 2]}</span
                                >{#if !minePage && present.state === PresentState.RESERVED && present.reserved_id}
                                    {@const reservedBy = data.users.find(
                                        (user) => user.id === present.reserved_id
                                    )}
                                    {#if reservedBy}
                                        <span class="text-gray-500">
                                            ({formatUser(reservedBy)})</span
                                        >
                                    {/if}
                                {/if}</span
                            >
                            <div class="flex gap-2 text-xl">
                                {#if !minePage && present.state === PresentState.AVAILABLE}
                                    <Icon
                                        onclick={() =>
                                            updateState(
                                                present.id,
                                                PresentState.RESERVED
                                            )}
                                        name="bi-gift"
                                    />
                                {:else if !minePage && present.state === PresentState.RESERVED && present.reserved_id === userState.data.id}
                                    <Icon
                                        onclick={() =>
                                            toggleBought(present.id, present.bought)}
                                        name={present.bought === 1
                                            ? 'bi-cart-check-fill'
                                            : 'bi-cart'}
                                        class={present.bought === 1
                                            ? 'text-green-500'
                                            : ''}
                                    />
                                    <Icon
                                        onclick={() =>
                                            updateState(present.id, PresentState.GIVEN)}
                                        name="bi-check-square"
                                    />
                                    <Icon
                                        onclick={() =>
                                            updateState(
                                                present.id,
                                                PresentState.AVAILABLE
                                            )}
                                        name="bi-gift-fill"
                                    />
                                {:else if !minePage && present.state === PresentState.GIVEN && present.reserved_id === userState.data.id}
                                    <Icon
                                        onclick={() =>
                                            toggleBought(present.id, present.bought)}
                                        name={present.bought === 1
                                            ? 'bi-cart-check-fill'
                                            : 'bi-cart'}
                                        class={present.bought === 1
                                            ? 'text-green-500'
                                            : ''}
                                    />
                                    <Icon
                                        onclick={() =>
                                            updateState(
                                                present.id,
                                                PresentState.RESERVED
                                            )}
                                        name="bi-check-square-fill"
                                    />
                                {/if}
                                {#if minePage}
                                    <a href="/app/presents/edit/{present.id}"
                                        ><Icon name="bi-pencil-fill" /></a
                                    >
                                    <Icon
                                        onclick={() => deletePresent(present.id)}
                                        name="bi-trash-fill"
                                        class="text-red-500"
                                    />
                                {/if}
                                {#if present.link}
                                    <a href={present.link} target="_blank">
                                        <Icon name="bi-link-45deg" />
                                    </a>
                                {/if}
                                {#if minePage}
                                    <Icon
                                        onclick={() => clonePresent(present.id)}
                                        name="bi-copy"
                                        title="Kopírovat"
                                    />
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>
            {/each}
        {/if}
    {/snippet}

    <div class="flex w-full flex-1 flex-col">
        <div class="font-poppins mb-4 flex w-full items-center justify-center gap-4">
            <a
                class={{ 'font-bold underline': page.params.page === 'mine' }}
                href="/app/presents/mine"><Icon name="bi-gift-fill" /> Moje dárky</a
            >
            <a
                class={{ 'font-bold underline': page.params.page === 'others' }}
                href="/app/presents/others"
                ><Icon name="bi-box2-heart-fill" /> Ostatních dárky</a
            >
        </div>
        <div class="flex flex-1 flex-col gap-2">
            {#if minePage}
                <Icon
                    onclick={() => goto('/app/presents/new')}
                    name="bi-plus-lg"
                    class="mx-auto text-xl text-green-500"
                />
                {@render presentList(presents)}
            {:else}
                {#each Object.entries(grouped) as [userId, presents] (userId)}
                    {@const idNum = parseInt(userId)}
                    <button
                        onclick={() => (opened[idNum] = !opened[idNum])}
                        class="cursor-pointer text-2xl font-bold"
                    >
                        <Icon
                            name={opened[idNum]
                                ? 'bi-caret-down-fill'
                                : 'bi-caret-up-fill'}
                        />
                        {formatUser(data.users.find((user) => user.id === idNum)!)}
                    </button>
                    {#if opened[idNum]}
                        <div class="flex flex-col gap-2">
                            {@render presentList(presents)}
                        </div>
                    {/if}
                {/each}
            {/if}
        </div>
    </div>
{/if}
