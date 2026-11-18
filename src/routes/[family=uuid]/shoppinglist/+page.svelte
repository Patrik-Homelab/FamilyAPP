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
        <div class="border-text flex flex-row gap-2 rounded-md border-2 p-2">
            {#if item.bought_by === null}
                <input
                    type="checkbox"
                    onchange={(ev) => {
                        if (ev.currentTarget.checked) {
                            selected = [...selected, item.id];
                        } else {
                            selected = selected.filter((id) => id !== item.id);
                        }
                    }}
                />
            {/if}
            <div class="flex w-1/4 items-center justify-center">
                {#if item.image}
                    <a href="/images/{item.image}" target="_blank"
                        ><Image name={item.image} alt="" /></a
                    >
                {:else}
                    <Icon name="bi-image" class="text-4xl" />
                {/if}
            </div>
            <div class="flex flex-1 flex-col justify-between gap-2">
                <div
                    class={[
                        'flex flex-row justify-between',
                        item.bought_by ? 'line-through' : ''
                    ]}
                >
                    <h1 class="text-xl font-bold lg:text-2xl">
                        {item.count}x {item.name}
                    </h1>
                    {#if userData.data.id === item.user_id}
                        <Icon
                            onclick={() => removeItem(item.id)}
                            name="bi-trash-fill"
                            class="text-red-500"
                        />
                    {/if}
                </div>
                {#if item.bought_by === null}
                    <h2 class="text-lg lg:text-xl">
                        Přidal/a: {formatUser(
                            data.users.find((u) => u.id === item.user_id)!
                        )} ({toDate(item.created_at)})
                    </h2>
                {:else}
                    <h2 class="text-lg lg:text-xl">
                        Zakoupil/a: {formatUser(
                            data.users.find((u) => u.id === item.bought_by)!
                        )} ({toDate(item.bought_at!)})
                    </h2>
                {/if}
            </div>
        </div>
    {/if}
{/snippet}

<div class="mt-2 h-full w-full flex-1">
    <div class="flex items-center justify-between text-2xl 2xl:text-3xl">
        <a href="/{page.params.family}/shoppinglist/new"><Icon name="bi-cart-plus" /></a>
        <Icon
            onclick={buy}
            name="bi-check-lg"
            class={[selected.length > 0 ? 'text-green-500' : 'text-gray-500']}
        />
    </div>
    <Title class="my-2">K nakoupení</Title>
    {#if toBuy.length === 0}
        <p class="text-center">Nákupní seznam, je prázdný</p>
    {:else}
        <div class="flex flex-col gap-2">
            {#each toBuy as item (item.id)}
                {@render renderItem(item)}
            {/each}
        </div>
    {/if}
    {#if bought.length > 0}
        <Title class="my-2">Zakoupeno</Title>
        <div class="flex flex-col gap-2">
            {#each bought as item (item.id)}
                {@render renderItem(item)}
            {/each}
        </div>
    {/if}
</div>
