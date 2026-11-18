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
    <div class="border-text bg-primary rounded-md border-2 p-2 font-bold">
        {name}
        <Icon
            onclick={() => removePermission(name)}
            name="bi-trash-fill"
            class="text-red-600"
        />
    </div>
{/snippet}

<div class="flex h-full w-full flex-1 flex-col">
    <Icon
        onclick={() => goto(`/${page.params.family}/groups/`)}
        name="bi-arrow-return-left"
        class="w-max text-2xl hover:text-gray-500"
    />
    <h1 class="font-poppins my-2 text-2xl font-bold">
        Úprava: ({groupData.id}) {groupData.name}
    </h1>
    <div class="flex h-full w-full flex-wrap gap-2">
        {#each groupData.permissions as permission (permission)}
            {@render item(permission)}
        {/each}
        <Icon
            onclick={addPermission}
            name="bi-plus-lg"
            class="border-text my-auto rounded-md border-2 px-1.5 py-0.5 text-green-600"
        />
    </div>
</div>
