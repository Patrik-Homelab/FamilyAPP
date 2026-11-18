<script lang="ts">
    import GroupTag from '$/components/group.svelte';
    import Icon from '$/components/Icon.svelte';
    import { API } from '$/lib/api';
    import { SwalAlert } from '$/lib/functions';
    import type { Group } from '$/types/database';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import type { Selectable } from 'kysely';
    import type { Snapshot } from './$types';

    import type { PageProps } from './$types';

    const { data }: PageProps = $props();

    let groups = $state<Selectable<Group>[]>();
    let staticGroups = $state<Selectable<Group>[]>();

    const resolveGroups = (groupData: (typeof data)['groups']) => {
        if (!groupData.status) return;

        groups = groupData.data;
        staticGroups = structuredClone(groupData.data);
    };

    let groupStatuses = $state<boolean[]>([]);

    $effect(() => {
        if (!groups || !staticGroups) return;

        groupStatuses = groups.map(
            (group, idx) =>
                group.name != staticGroups![idx]?.name ||
                group.bg_color != staticGroups![idx]?.bg_color ||
                group.text_color != staticGroups![idx]?.text_color
        );
    });

    resolveGroups(data.groups);

    const updateGroup = async (groupIdx: number) => {
        if (!groups![groupIdx]) return;

        const response = await API.groups.PATCH(groups![groupIdx]);
        if (!response.status) {
            SwalAlert({
                icon: 'error',
                title: response.message
            });
            return;
        }
        SwalAlert({
            icon: 'success',
            title: 'Skupina úspěšně upravena'
        });

        staticGroups![groupIdx] = { ...groups![groupIdx] };
    };

    const addGroup = async (groupIdx: number) => {
        if (!groups![groupIdx]) return;
        const response = await API.groups.PUT({ ...groups![groupIdx] });
        if (!response.status) {
            SwalAlert({
                icon: 'error',
                title: response.message
            });
            return;
        }

        SwalAlert({
            icon: 'success',
            title: 'Skupina úspěšně přidána'
        });

        const currentData = groups![groupIdx];
        currentData.id = response.data;
        staticGroups?.push(currentData);
    };

    const removeGroup = async (groupId: number) => {
        const alert = await SwalAlert({
            toast: false,
            position: 'center',
            title: 'Opravdu chceš smazat tuto skupinu?',
            showCancelButton: true,
            cancelButtonText: 'Ne',
            showConfirmButton: true,
            confirmButtonText: 'Ano',
            timer: 0
        });

        if (!alert.isConfirmed) return;

        const response = await API.groups.DELETE(groupId);
        if (!response.status) {
            SwalAlert({
                icon: 'error',
                title: response.message
            });
            return;
        }

        SwalAlert({
            icon: 'success',
            title: 'Spukina úspěšně odebrána'
        });

        staticGroups = staticGroups!.filter((group) => group.id !== groupId);
        groups = groups!.filter((group) => group.id !== groupId);
    };

    const tryUpdateGroup = (groupIdx: number) => {
        if (groupStatuses?.[groupIdx] === false) {
            SwalAlert({
                icon: 'error',
                text: 'Tato skupina nemá žádnou novou úpravu'
            });
            return;
        }

        return staticGroups![groupIdx] === undefined
            ? addGroup(groupIdx)
            : updateGroup(groupIdx);
    };

    const resetGroup = (groupId: number) => {
        if (!groups || !staticGroups) return;

        groups[groupId] = { ...staticGroups[groupId] };
    };

    const addNew = () => {
        if (!groups || !staticGroups) return;

        groups.push({
            id: groups.length + 1,
            family_id: 0,
            name: 'group',
            bg_color: '#000',
            text_color: '#fff'
        });
    };

    export const snapshot = {
        capture: () => {
            return {
                groups,
                staticGroups
            };
        },
        restore: (values) => {
            groups = values.groups;
            staticGroups = values.staticGroups;
        }
    } satisfies Snapshot<{
        groups: typeof groups;
        staticGroups: typeof staticGroups;
    }>;
</script>

<div class="mt-2 h-full w-full flex-1">
    {#if groups}
        <table class="border-text w-full border-collapse border-2">
            <thead>
                <tr class="border-text border-2">
                    <th class="border-text border-2">Id</th>
                    <th class="border-text border-2">Jméno</th>
                    <th class="border-text border-2">Barva Textu</th>
                    <th class="border-text border-2">Barva Pozadí</th>
                    <th class="border-text border-2">Ukázka</th>
                    <th class="border-text border-2"></th>
                </tr>
            </thead>
            <tbody>
                {#each groups as group, idx (idx)}
                    {@const inputs = {
                        text: undefined as HTMLInputElement | undefined,
                        background: undefined as HTMLInputElement | undefined
                    }}
                    <tr class="border-text border-2">
                        <td class="border-text border-2">{group.id}</td>
                        <td class="border-text border-2">
                            <input
                                class="w-full border-none bg-transparent text-center outline-hidden"
                                bind:value={group.name}
                                size={1}
                            />
                        </td>
                        <td
                            onclick={() => inputs.text?.click()}
                            class="border-text border-2"
                            style="background-color: {group.text_color};"
                        >
                            <input
                                bind:this={inputs.text}
                                bind:value={group.text_color}
                                hidden
                                type="color"
                            />
                        </td>
                        <td
                            onclick={() => inputs.background?.click()}
                            class="border-text border-2"
                            style="background-color: {group.bg_color};"
                        >
                            <input
                                bind:this={inputs.background}
                                bind:value={group.bg_color}
                                hidden
                                type="color"
                            />
                        </td>
                        <td class="flex items-center justify-center">
                            <GroupTag
                                backgroundColor={group.bg_color}
                                textColor={group.text_color}>{group.name}</GroupTag
                            >
                        </td>
                        <td class="border-text border-2 text-xl">
                            <div class="flex items-center justify-center">
                                {#if groupStatuses?.[idx] !== false}
                                    <Icon
                                        onclick={() => tryUpdateGroup(idx)}
                                        name="bi-check-lg"
                                        class="text-green-600"
                                    />
                                    {#if staticGroups!.length > idx}
                                        <Icon
                                            onclick={() => resetGroup(idx)}
                                            name="bi-arrow-counterclockwise"
                                            class="text-red-600"
                                        />
                                    {/if}
                                {/if}
                                <Icon
                                    onclick={() => removeGroup(group.id)}
                                    name="bi-trash-fill"
                                    class="text-red-500"
                                />
                                <Icon
                                    onclick={() =>
                                        goto(`/${page.params.family}/groups/${group.id}`)}
                                    name="bi-gear-fill"
                                    class="text-gray-500"
                                />
                            </div>
                        </td>
                    </tr>
                {/each}
                <tr class="border-text border-2">
                    <td class="border-text border-2 text-center text-2xl" colspan={6}>
                        <Icon onclick={addNew} name="bi-plus-lg" class="text-green-600" />
                    </td>
                </tr>
            </tbody>
        </table>
    {/if}
</div>
