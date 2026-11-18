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

            await goto(`/${page.params.family}/presents/edit/${response.data.id}`);
        } finally {
            isCloning = false;
        }
    };
</script>

{#if userState.logged}
    {#snippet presentList(presents: Present[])}
        {#if presents.length === 0}
            <div
                class="bg-secondary/60 text-text/60 rounded-2xl border border-white/10 p-6 text-center text-sm"
            >
                {#if page.params.page === 'mine'}Nemáš žádné dárky{:else}Nemá žádné dárky{/if}
            </div>
        {:else}
            <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {#each presents as present (present.id)}
                    <div
                        class="bg-secondary/75 flex flex-row gap-3.5 rounded-2xl border border-white/10 p-3.5 shadow-xs transition-colors hover:border-white/20"
                    >
                        <div
                            class="bg-background/60 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10"
                        >
                            {#if present.image}
                                <a
                                    href="/images/{present.image}"
                                    target="_blank"
                                    class="h-full w-full"
                                >
                                    <Image
                                        name={present.image}
                                        alt={present.name}
                                        class="h-full w-full object-cover"
                                    />
                                </a>
                            {:else}
                                <Icon name="bi-gift" class="text-text/25 text-3xl" />
                            {/if}
                        </div>
                        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
                            <div class="flex items-start justify-between gap-2">
                                <h2
                                    class="font-poppins truncate text-base font-bold lg:text-lg"
                                >
                                    {present.name}
                                </h2>
                                <span
                                    class="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-bold"
                                >
                                    {parseFloat(present.price)} Kč
                                </span>
                            </div>
                            {#if present.description}
                                <p class="text-text/70 line-clamp-2 text-xs lg:text-sm">
                                    {present.description}
                                </p>
                            {/if}
                            <div
                                class="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1"
                            >
                                <span class="text-xs font-semibold">
                                    <span
                                        class={[
                                            'inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5',
                                            stateColors[present.state as 0 | 1 | 2]
                                        ]}
                                    >
                                        {states[present.state as 0 | 1 | 2]}
                                    </span>
                                    {#if !minePage && present.state === PresentState.RESERVED && present.reserved_id}
                                        {@const reservedBy = data.users.find(
                                            (user) => user.id === present.reserved_id
                                        )}
                                        {#if reservedBy}
                                            <span
                                                class="text-text/55 ml-1 text-xs font-normal"
                                            >
                                                ({formatUser(reservedBy)})
                                            </span>
                                        {/if}
                                    {/if}
                                </span>
                                <div class="flex items-center gap-1.5 text-base">
                                    {#if !minePage && present.state === PresentState.AVAILABLE}
                                        <button
                                            type="button"
                                            onclick={() =>
                                                updateState(
                                                    present.id,
                                                    PresentState.RESERVED
                                                )}
                                            class="hover:bg-accent/15 hover:text-accent flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 transition-colors"
                                            title="Rezervovat dárek"
                                        >
                                            <Icon name="bi-gift" />
                                        </button>
                                    {:else if !minePage && present.state === PresentState.RESERVED && present.reserved_id === userState.data.id}
                                        <button
                                            type="button"
                                            onclick={() =>
                                                toggleBought(present.id, present.bought)}
                                            class={[
                                                'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 transition-colors hover:bg-white/10',
                                                present.bought === 1
                                                    ? 'text-emerald-400'
                                                    : ''
                                            ]}
                                            title={present.bought === 1
                                                ? 'Označit jako nekupené'
                                                : 'Označit jako koupené'}
                                        >
                                            <Icon
                                                name={present.bought === 1
                                                    ? 'bi-cart-check-fill'
                                                    : 'bi-cart'}
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            onclick={() =>
                                                updateState(
                                                    present.id,
                                                    PresentState.GIVEN
                                                )}
                                            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 transition-colors hover:bg-white/10"
                                            title="Označit jako předané"
                                        >
                                            <Icon name="bi-check-square" />
                                        </button>
                                        <button
                                            type="button"
                                            onclick={() =>
                                                updateState(
                                                    present.id,
                                                    PresentState.AVAILABLE
                                                )}
                                            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 text-amber-400 transition-colors hover:bg-white/10"
                                            title="Zrušit rezervaci"
                                        >
                                            <Icon name="bi-gift-fill" />
                                        </button>
                                    {:else if !minePage && present.state === PresentState.GIVEN && present.reserved_id === userState.data.id}
                                        <button
                                            type="button"
                                            onclick={() =>
                                                toggleBought(present.id, present.bought)}
                                            class={[
                                                'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 transition-colors hover:bg-white/10',
                                                present.bought === 1
                                                    ? 'text-emerald-400'
                                                    : ''
                                            ]}
                                            title="Koupeno"
                                        >
                                            <Icon
                                                name={present.bought === 1
                                                    ? 'bi-cart-check-fill'
                                                    : 'bi-cart'}
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            onclick={() =>
                                                updateState(
                                                    present.id,
                                                    PresentState.RESERVED
                                                )}
                                            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 transition-colors hover:bg-white/10"
                                            title="Vrátit do rezervace"
                                        >
                                            <Icon name="bi-check-square-fill" />
                                        </button>
                                    {/if}
                                    {#if minePage}
                                        <a
                                            href="/{page.params
                                                .family}/presents/edit/{present.id}"
                                            class="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 transition-colors hover:bg-white/10"
                                            title="Upravit"
                                        >
                                            <Icon name="bi-pencil-fill" />
                                        </a>
                                        <button
                                            type="button"
                                            onclick={() => clonePresent(present.id)}
                                            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 transition-colors hover:bg-white/10"
                                            title="Kopírovat"
                                        >
                                            <Icon name="bi-copy" />
                                        </button>
                                        <button
                                            type="button"
                                            onclick={() => deletePresent(present.id)}
                                            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 text-red-400 transition-colors hover:bg-red-500/15"
                                            title="Smazat"
                                        >
                                            <Icon name="bi-trash-fill" />
                                        </button>
                                    {/if}
                                    {#if present.link}
                                        <a
                                            href={present.link}
                                            target="_blank"
                                            class="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-sky-400 transition-colors hover:bg-sky-500/15"
                                            title="Otevřít odkaz"
                                        >
                                            <Icon name="bi-link-45deg" />
                                        </a>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    {/snippet}

    <div class="flex w-full flex-1 flex-col gap-5 pb-6">
        <div
            class="bg-secondary/80 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-3 shadow-sm"
        >
            <div class="bg-background/70 flex rounded-xl border border-white/10 p-1">
                <a
                    class={[
                        'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all',
                        page.params.page === 'mine'
                            ? 'bg-accent text-white shadow-xs'
                            : 'text-text/70 hover:text-text'
                    ]}
                    href="/{page.params.family}/presents/mine"
                >
                    <Icon name="bi-gift-fill" /> Moje dárky
                </a>
                <a
                    class={[
                        'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all',
                        page.params.page === 'others'
                            ? 'bg-accent text-white shadow-xs'
                            : 'text-text/70 hover:text-text'
                    ]}
                    href="/{page.params.family}/presents/others"
                >
                    <Icon name="bi-box2-heart-fill" /> Ostatních dárky
                </a>
            </div>

            {#if minePage}
                <button
                    type="button"
                    onclick={() => goto(`/${page.params.family}/presents/new`)}
                    class="bg-accent inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white shadow-xs transition hover:brightness-110"
                >
                    <Icon name="bi-plus-lg" />
                    <span>Přidat dárek</span>
                </button>
            {/if}
        </div>

        <div class="flex flex-1 flex-col gap-3">
            {#if minePage}
                {@render presentList(presents)}
            {:else if Object.keys(grouped).length === 0}
                <div
                    class="bg-secondary/60 text-text/60 rounded-2xl border border-white/10 p-8 text-center text-sm"
                >
                    Nikdo z rodiny zatím nepřidal žádné dárky.
                </div>
            {:else}
                {#each Object.entries(grouped) as [userId, presents] (userId)}
                    {@const idNum = parseInt(userId)}
                    <div
                        class="bg-secondary/60 overflow-hidden rounded-2xl border border-white/10"
                    >
                        <button
                            type="button"
                            onclick={() => (opened[idNum] = !opened[idNum])}
                            class="flex w-full cursor-pointer items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04]"
                        >
                            <span
                                class="font-poppins flex items-center gap-2.5 text-lg font-bold"
                            >
                                <Icon
                                    name={opened[idNum]
                                        ? 'bi-caret-down-fill'
                                        : 'bi-caret-right-fill'}
                                    class="text-accent"
                                />
                                {formatUser(
                                    data.users.find((user) => user.id === idNum)!
                                )}
                            </span>
                            <span
                                class="text-text/75 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-semibold"
                            >
                                {presents.length}
                            </span>
                        </button>
                        {#if opened[idNum]}
                            <div class="border-t border-white/10 p-3.5">
                                {@render presentList(presents)}
                            </div>
                        {/if}
                    </div>
                {/each}
            {/if}
        </div>
    </div>
{/if}
