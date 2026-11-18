<script lang="ts">
    import { Select } from '$/components/form';
    import Icon from '$/components/Icon.svelte';
    import { API } from '$/lib/api';
    import { SwalAlert } from '$/lib/functions';
    import type { User } from '$/types/database';
    import { page } from '$app/state';
    import type { Selectable } from 'kysely';

    import type { PageProps } from './$types';

    const { data }: PageProps = $props();

    const groups = data.groups;
    let users = $state<
        (Omit<Selectable<User>, 'password'> & {
            group_id: number | null;
        })[]
    >();

    const resolveUsers = (userData: (typeof data)['users']) => {
        if (!userData.status) return;

        users = userData.data;
    };

    resolveUsers(data.users);

    const updateGroup = async (userId: number, group: number | null) => {
        const response = await API.users.PATCH({
            id: userId,
            group
        });

        if (!response.status) {
            SwalAlert({
                icon: 'error',
                title: response.message
            });
            return;
        }

        SwalAlert({
            icon: 'success',
            title: 'Skupina úspěšně aktualizována'
        });
    };

    const createInvitation = async () => {
        const response = await API.invitation.GET();
        if (!response.status) {
            SwalAlert({
                icon: 'error',
                title: response.message
            });
            return;
        }

        const link = `${page.url.origin}/invitation/${response.data}`;

        try {
            await navigator.clipboard.writeText(link);

            SwalAlert({
                icon: 'success',
                title: 'Pozívací odkaz byl úspěšně zkopírován'
            });
        } catch (err) {
            console.error(err);
            await SwalAlert({
                icon: 'error',
                title: 'Nepovedlo se zkopírovat odkaz\n\nAAA'
            });

            SwalAlert({
                toast: false,
                timer: 0,
                title: link,
                position: 'center',
                showConfirmButton: true,
                confirmButtonText: 'Ok'
            });
        }
    };
</script>

<div class="mt-2 h-full w-full flex-1">
    {#if users}
        <table class="border-text w-full border-collapse border-2">
            <thead>
                <tr class="border-text border-2">
                    <th class="border-text border-2">Id</th>
                    <th class="border-text border-2">Jméno</th>
                    <th class="border-text border-2">Skupina</th>
                </tr>
            </thead>
            <tbody>
                {#each users as user (user.id)}
                    <tr class="border-text border-2">
                        <td class="border-text border-2">{user.id}</td>
                        <td class="border-text border-2">{user.username}</td>
                        <td class="flex justify-center">
                            <Select
                                class="w-full border-none text-center lg:w-auto"
                                bind:value={user.group_id}
                                onchange={() => updateGroup(user.id, user.group_id)}
                            >
                                <option value={null} selected>Žádná</option>
                                {#each groups as group (group.id)}
                                    <option value={group.id}>{group.name}</option>
                                {/each}
                            </Select>
                        </td>
                    </tr>
                {/each}
                <tr>
                    <td class="border-text border-2 text-center text-2xl" colspan={3}>
                        <Icon
                            onclick={createInvitation}
                            name="bi-plus-lg"
                            class="text-green-600"
                        />
                    </td>
                </tr>
            </tbody>
        </table>
    {/if}
</div>
