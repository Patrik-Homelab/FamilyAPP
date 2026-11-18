<script lang="ts">
    import Title from '$/components/headers/Title.svelte';
    import Icon from '$/components/Icon.svelte';
    import Image from '$/components/Image.svelte';
    import { API } from '$/lib/api';
    import { formatUser, SwalAlert, toDate } from '$/lib/functions';
    import { getState } from '$/lib/state.svelte';
    import type { Shoppinglist } from '$/types/database';
    import { page } from '$app/state';
    import type { Selectable } from 'kysely';

    import type { PageProps } from './$types';

    const { data }: PageProps = $props();

    data.data = data.data.map((item) => ({
        ...item,
        //because data travel as json, the dates are converted to string, even
        //if typescript says it's a Date :)
        created_at: new Date(item.created_at),
        bought_at: item.bought_at === null ? null : new Date(item.bought_at)
    }));

    let toBuy = $state(
        data.data
            .filter((item) => item.bought_by === null)
            .toSorted((a, b) => b.created_at.getTime() - a.created_at.getTime())
    );
    let bought = $state(
        data.data
            .filter((item) => item.bought_by !== null)
            .toSorted((a, b) => b.bought_at!.getTime() - a.bought_at!.getTime())
    );

    let selected = $state<number[]>([]);

    const userData = getState().userState;

    const removeItem = async (id: number) => {
        const confirmation = await SwalAlert({
            toast: false,
            position: 'center',
            timer: 0,
            title: 'Opravdu chceš smazat tuto položku?',
            showCancelButton: true,
            cancelButtonText: 'Ne',
            showConfirmButton: true,
            confirmButtonText: 'Ano'
        });

        if (!confirmation.isConfirmed) {
            return;
        }

        const response = await API.shoppinglist.DELETE(id);

        if (!response.status) {
            SwalAlert({
                title: response.message,
                icon: 'error'
            });
            return;
        }

        toBuy = toBuy.filter((item) => item.id !== id);
        bought = bought.filter((item) => item.id !== id);
    };

    const buy = async () => {
        if (selected.length === 0) {
            return;
        }

        const confirmation = await SwalAlert({
            toast: false,
            position: 'center',
            timer: 0,
            title: 'Opravdu chceš označit vybrané položky jako zakoupené?',
            text: `${selected
                .map((id) => toBuy.find((item) => item.id === id)!)
                .map((item) => `${item.count}x ${item.name}`)
                .join(', ')}`,
            showCancelButton: true,
            cancelButtonText: 'Ne',
            showConfirmButton: true,
            confirmButtonText: 'Ano'
        });

        if (!confirmation.isConfirmed) {
            return;
        }

        const response = await API.shoppinglist.POST(selected);

        if (!response.status) {
            SwalAlert({
                title: response.message,
                icon: 'error'
            });
            return;
        }

        bought = [...bought, ...toBuy.filter((item) => selected.includes(item.id))];
        toBuy = toBuy.filter((item) => !selected.includes(item.id));

        selected = [];

        SwalAlert({
            title: 'Položky byly úspěšně označeny jako zakoupené',
            icon: 'success'
        });
    };
</script>

{#snippet renderItem(item: Selectable<Shoppinglist>)}
    {#if userData.logged}
        <div
            class={[
                'bg-secondary/75 flex flex-row items-center gap-3 rounded-2xl border border-white/10 p-3 shadow-xs transition-colors',
                item.bought_by ? 'opacity-65' : 'hover:border-white/20'
            ]}
        >
            {#if item.bought_by === null}
                <input
                    type="checkbox"
                    class="accent-accent h-5 w-5 shrink-0 cursor-pointer rounded"
                    onchange={(ev) => {
                        if (ev.currentTarget.checked) {
                            selected = [...selected, item.id];
                        } else {
                            selected = selected.filter((id) => id !== item.id);
                        }
                    }}
                />
            {/if}
            <div
                class="bg-background/60 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10"
            >
                {#if item.image}
                    <a href="/images/{item.image}" target="_blank" class="h-full w-full">
                        <Image
                            name={item.image}
                            alt={item.name}
                            class="h-full w-full object-cover"
                        />
                    </a>
                {:else}
                    <Icon name="bi-image" class="text-text/30 text-2xl" />
                {/if}
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-1">
                <div class="flex items-start justify-between gap-2">
                    <h1
                        class={[
                            'font-poppins text-base font-bold lg:text-lg',
                            item.bought_by ? 'line-through' : ''
                        ]}
                    >
                        <span
                            class="bg-accent/15 text-accent mr-1.5 inline-block rounded-md px-1.5 py-0.5 text-xs font-bold"
                        >
                            {item.count}×
                        </span>
                        {item.name}
                    </h1>
                    {#if userData.data.id === item.user_id}
                        <button
                            type="button"
                            onclick={() => removeItem(item.id)}
                            class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-500/15"
                            title="Smazat položku"
                        >
                            <Icon name="bi-trash-fill" />
                        </button>
                    {/if}
                </div>
                {#if item.bought_by === null}
                    <p class="text-text/60 text-xs lg:text-sm">
                        Přidal/a: {formatUser(
                            data.users.find((u) => u.id === item.user_id)!
                        )} · {toDate(item.created_at)}
                    </p>
                {:else}
                    <p class="text-text/60 text-xs lg:text-sm">
                        Zakoupil/a: {formatUser(
                            data.users.find((u) => u.id === item.bought_by)!
                        )} · {toDate(item.bought_at!)}
                    </p>
                {/if}
            </div>
        </div>
    {/if}
{/snippet}

<div class="flex flex-1 flex-col gap-5 pb-6">
    <div
        class="bg-secondary/80 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-4 shadow-sm"
    >
        <Title class="text-xl lg:text-2xl">Nákupní seznam</Title>
        <div class="flex flex-wrap items-center gap-2">
            <a
                href="/{page.params.family}/shoppinglist/new"
                class="bg-accent inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white shadow-xs transition hover:brightness-110"
            >
                <Icon name="bi-cart-plus" />
                <span>Přidat položku</span>
            </a>
            <button
                type="button"
                onclick={buy}
                disabled={selected.length === 0}
                class={[
                    'inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40',
                    selected.length > 0
                        ? 'border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-500'
                        : 'text-text/60 border-white/15 bg-white/5'
                ]}
            >
                <Icon name="bi-check-lg" />
                <span>Zakoupeno ({selected.length})</span>
            </button>
        </div>
    </div>

    <div class="flex flex-col gap-2.5">
        <h2 class="font-poppins text-text/80 text-lg font-bold">K nakoupení</h2>
        {#if toBuy.length === 0}
            <div
                class="bg-secondary/60 text-text/60 rounded-2xl border border-white/10 p-6 text-center text-sm"
            >
                Nákupní seznam je prázdný
            </div>
        {:else}
            <div class="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {#each toBuy as item (item.id)}
                    {@render renderItem(item)}
                {/each}
            </div>
        {/if}
    </div>

    {#if bought.length > 0}
        <div class="flex flex-col gap-2.5">
            <h2 class="font-poppins text-text/60 text-lg font-bold">Zakoupeno</h2>
            <div class="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {#each bought as item (item.id)}
                    {@render renderItem(item)}
                {/each}
            </div>
        </div>
    {/if}
</div>
