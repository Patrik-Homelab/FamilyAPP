<script lang="ts">
    import { Button } from '$/components/form';
    import GroupTag from '$/components/group.svelte';
    import Title from '$/components/headers/Title.svelte';
    import Icon from '$/components/Icon.svelte';
    import { Table, Td, Th, Tr } from '$/components/table';
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

<div class="flex flex-1 flex-col gap-5 pb-6">
    <div
        class="bg-secondary/80 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-4 shadow-sm"
    >
        <Title class="text-xl lg:text-2xl">Správa skupin</Title>
        <Button onclick={addNew} class="w-auto bg-emerald-600 hover:bg-emerald-500">
            <Icon name="bi-plus-lg" />
            <span>Nová skupina</span>
        </Button>
    </div>

    {#if groups}
        <Table>
            <thead>
                <Tr>
                    <Th>ID</Th>
                    <Th>Název</Th>
                    <Th>Text</Th>
                    <Th>Pozadí</Th>
                    <Th>Ukázka</Th>
                    <Th></Th>
                </Tr>
            </thead>
            <tbody class="text-center">
                {#each groups as group, idx (idx)}
                    {@const inputs = {
                        text: undefined as HTMLInputElement | undefined,
                        background: undefined as HTMLInputElement | undefined
                    }}
                    <Tr>
                        <Td class="text-text/60">{group.id}</Td>
                        <Td>
                            <input
                                class="bg-background/50 focus:border-accent w-full min-w-24 rounded-lg border border-white/10 px-2 py-1 text-center text-sm font-semibold outline-hidden"
                                bind:value={group.name}
                                size={1}
                            />
                        </Td>
                        <Td>
                            <button
                                type="button"
                                onclick={() => inputs.text?.click()}
                                class="mx-auto block h-7 w-10 cursor-pointer rounded-lg border border-white/20 shadow-xs"
                                style="background-color: {group.text_color};"
                                aria-label="Barva textu"
                            ></button>
                            <input
                                bind:this={inputs.text}
                                bind:value={group.text_color}
                                hidden
                                type="color"
                            />
                        </Td>
                        <Td>
                            <button
                                type="button"
                                onclick={() => inputs.background?.click()}
                                class="mx-auto block h-7 w-10 cursor-pointer rounded-lg border border-white/20 shadow-xs"
                                style="background-color: {group.bg_color};"
                                aria-label="Barva pozadí"
                            ></button>
                            <input
                                bind:this={inputs.background}
                                bind:value={group.bg_color}
                                hidden
                                type="color"
                            />
                        </Td>
                        <Td>
                            <GroupTag
                                backgroundColor={group.bg_color}
                                textColor={group.text_color}>{group.name}</GroupTag
                            >
                        </Td>
                        <Td>
                            <div class="flex items-center justify-center gap-1.5">
                                {#if groupStatuses?.[idx] !== false}
                                    <button
                                        type="button"
                                        onclick={() => tryUpdateGroup(idx)}
                                        class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 transition-colors hover:bg-emerald-500/25"
                                        title="Uložit"
                                    >
                                        <Icon name="bi-check-lg" />
                                    </button>
                                    {#if staticGroups!.length > idx}
                                        <button
                                            type="button"
                                            onclick={() => resetGroup(idx)}
                                            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 text-amber-400 transition-colors hover:bg-white/10"
                                            title="Vrátit změny"
                                        >
                                            <Icon name="bi-arrow-counterclockwise" />
                                        </button>
                                    {/if}
                                {/if}
                                <button
                                    type="button"
                                    onclick={() =>
                                        goto(`/${page.params.family}/groups/${group.id}`)}
                                    class="text-text/80 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 transition-colors hover:bg-white/10"
                                    title="Oprávnění skupiny"
                                >
                                    <Icon name="bi-gear-fill" />
                                </button>
                                <button
                                    type="button"
                                    onclick={() => removeGroup(group.id)}
                                    class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 text-red-400 transition-colors hover:bg-red-500/15"
                                    title="Smazat skupinu"
                                >
                                    <Icon name="bi-trash-fill" />
                                </button>
                            </div>
                        </Td>
                    </Tr>
                {/each}
            </tbody>
        </Table>
    {/if}
</div>
