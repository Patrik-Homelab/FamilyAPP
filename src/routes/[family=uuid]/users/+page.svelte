<script lang="ts">
    import { Button, Select } from '$/components/form';
    import Title from '$/components/headers/Title.svelte';
    import Icon from '$/components/Icon.svelte';
    import { Table, Td, Th, Tr } from '$/components/table';
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

<div class="flex flex-1 flex-col gap-5 pb-6">
    <div
        class="bg-secondary/80 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-4 shadow-sm"
    >
        <Title class="text-xl lg:text-2xl">Správa uživatelů</Title>
        <Button
            onclick={createInvitation}
            class="w-auto bg-emerald-600 hover:bg-emerald-500"
        >
            <Icon name="bi-person-plus-fill" />
            <span>Vytvořit pozvánku</span>
        </Button>
    </div>

    {#if users}
        <Table>
            <thead>
                <Tr>
                    <Th>ID</Th>
                    <Th class="text-left">Uživatel</Th>
                    <Th>Skupina</Th>
                </Tr>
            </thead>
            <tbody class="text-center">
                {#each users as user (user.id)}
                    <Tr>
                        <Td class="text-text/60">{user.id}</Td>
                        <Td class="text-left">
                            <div class="font-semibold">
                                {user.firstname}
                                {user.lastname}
                            </div>
                            <div class="text-text/55 text-xs">@{user.username}</div>
                        </Td>
                        <Td>
                            <div class="flex justify-center">
                                <Select
                                    class="w-full max-w-52 py-1.5 text-center text-sm"
                                    bind:value={user.group_id}
                                    onchange={() => updateGroup(user.id, user.group_id)}
                                >
                                    <option value={null} selected>Žádná</option>
                                    {#each groups as group (group.id)}
                                        <option value={group.id}>{group.name}</option>
                                    {/each}
                                </Select>
                            </div>
                        </Td>
                    </Tr>
                {/each}
            </tbody>
        </Table>
    {/if}
</div>
