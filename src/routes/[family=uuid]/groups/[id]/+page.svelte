<script lang="ts">
    import Icon from '$/components/Icon.svelte';
    import { API } from '$/lib/api';
    import { SwalAlert } from '$/lib/functions';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import type { PageServerData } from './$types';

    const { data }: { data: PageServerData } = $props();

    let groupData = $state(data.groupData);

    const removePermission = async (name: string) => {
        const response = await API.permissions.DELETE({
            id: groupData.id,
            permission: name
        });

        if (!response.status) {
            SwalAlert({
                icon: 'error',
                title: 'Nepovedlo se odebrat oprávnění'
            });
            return;
        }

        SwalAlert({
            icon: 'success',
            title: 'Oprávnění úspěšně odebráno'
        });

        groupData.permissions = groupData.permissions.filter((perm) => perm !== name);
    };

    const addPermission = async () => {
        const data = await SwalAlert<string>({
            toast: false,
            timer: 0,
            position: 'center',
            title: 'Zadej jméno permisse',
            html: '<input id="new-perm" style="outline:none;" placeholder="admin.group" type="text" />',
            showCancelButton: true,
            cancelButtonText: 'Zrušit',
            showConfirmButton: true,
            confirmButtonText: 'Přidat',
            preConfirm: () => document.querySelector<HTMLInputElement>('#new-perm')!.value
        });
        if (!data.isConfirmed) return;
        if (!data.value) return;

        const response = await API.permissions.PUT({
            id: groupData.id,
            permission: data.value
        });
        if (!response.status) {
            SwalAlert({
                icon: 'error',
                title: 'Nepovedlo se přidat oprávnění'
            });
            return;
        }

        groupData.permissions.push(data.value);
    };
</script>

{#snippet item(name: string)}
    <div
        class="bg-secondary/90 inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 text-sm font-semibold shadow-xs"
    >
        <span>{name}</span>
        <button
            type="button"
            onclick={() => removePermission(name)}
            class="cursor-pointer text-red-400 transition-colors hover:text-red-300"
            title="Odebrat oprávnění"
        >
            <Icon name="bi-trash-fill" />
        </button>
    </div>
{/snippet}

<div class="flex flex-1 flex-col gap-5 pb-6">
    <button
        type="button"
        onclick={() => goto(`/${page.params.family}/groups/`)}
        class="text-text/75 hover:text-text bg-secondary/70 inline-flex w-max cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-sm font-semibold transition-colors"
    >
        <Icon name="bi-arrow-return-left" />
        <span>Zpět na skupiny</span>
    </button>

    <div
        class="bg-secondary/80 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-4 shadow-sm"
    >
        <h1 class="font-poppins text-xl font-bold lg:text-2xl">
            Oprávnění skupiny: {groupData.name}
            <span class="text-text/50 text-sm font-normal">(#{groupData.id})</span>
        </h1>
        <button
            type="button"
            onclick={addPermission}
            class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
            <Icon name="bi-plus-lg" />
            <span>Přidat oprávnění</span>
        </button>
    </div>

    <div class="flex flex-wrap gap-2.5">
        {#if groupData.permissions.length === 0}
            <p class="text-text/60 text-sm">Tato skupina zatím nemá žádná oprávnění.</p>
        {:else}
            {#each groupData.permissions as permission (permission)}
                {@render item(permission)}
            {/each}
        {/if}
    </div>
</div>
