<script lang="ts">
    import Title from '$/components/headers/Title.svelte';
    import Icon from '$/components/Icon.svelte';
    import { Table, Td, Th, Tr } from '$/components/table';
    import { API } from '$/lib/api';
    import { formatUser, SwalAlert, toDate } from '$/lib/functions';
    import type { DeArray } from '$/types/types';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';

    import type { PageProps } from './$types';

    const { data }: PageProps = $props();

    type PersonDebt = Omit<DeArray<(typeof data)['who']>, 'whom'>[];

    let grouppedData = $state<Record<number, PersonDebt>>({});
    let who = $state(data.who);
    let whom = $state(data.whom);

    const groupData = () => {
        grouppedData = {};
        for (const { whom, ...rest } of who.filter((item) => item.resolved_on === null)) {
            if (!(whom in grouppedData)) {
                grouppedData[whom] = [];
            }

            grouppedData[whom].push(rest);
        }
    };
    groupData();

    const remove = async (id: number) => {
        const alert = await SwalAlert({
            toast: false,
            title: 'Opravdu chceteš smazat tento záznam?',
            position: 'center',
            timer: 0,
            showConfirmButton: true,
            confirmButtonText: 'Ano',
            showCancelButton: true,
            cancelButtonText: 'Ne'
        });

        if (!alert.isConfirmed) {
            return;
        }

        const response = await API.debt.DELETE(id);
        if (!response.status) {
            SwalAlert({
                icon: 'error',
                title: response.message
            });
            return;
        }

        SwalAlert({
            icon: 'success',
            title: 'Záznam byl úspěšně smazán'
        });

        whom = whom.filter((item) => item.id !== id);
        who = who.filter((item) => item.id !== id);
        groupData();
    };
    const totalOwedByMe = $derived(
        Object.values(grouppedData)
            .flat()
            .reduce((sum, item) => sum + parseFloat(item.price), 0)
    );

    const totalOwedToMe = $derived(
        whom
            .filter((item) => item.resolved_on === null)
            .reduce((sum, item) => sum + parseFloat(item.price), 0)
    );
</script>

<div class="flex flex-1 flex-col gap-6 pb-6">
    <!-- Header + KPI Summary -->
    <div
        class="bg-secondary/80 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-4 shadow-sm"
    >
        <Title class="text-xl lg:text-2xl">Dlužníček</Title>
        <button
            type="button"
            onclick={() => goto(`/${page.params.family}/debt/new`)}
            class="bg-accent inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white shadow-xs transition hover:brightness-110"
        >
            <Icon name="bi-plus-lg" />
            <span>Přidat dluh</span>
        </button>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
            class="bg-secondary/75 flex flex-col gap-1 rounded-2xl border border-white/10 p-4"
        >
            <span class="text-text/60 text-xs font-semibold tracking-wider uppercase">
                Celkem dlužíš
            </span>
            <span class="font-poppins text-2xl font-bold text-rose-400">
                {totalOwedByMe} Kč
            </span>
        </div>
        <div
            class="bg-secondary/75 flex flex-col gap-1 rounded-2xl border border-white/10 p-4"
        >
            <span class="text-text/60 text-xs font-semibold tracking-wider uppercase">
                Neuhrazeno tobě
            </span>
            <span class="font-poppins text-2xl font-bold text-emerald-400">
                {totalOwedToMe} Kč
            </span>
        </div>
    </div>

    <div class="flex flex-col gap-3">
        <Title class="text-lg lg:text-xl">Dlužíš</Title>
        {#if Object.values(grouppedData).length === 0}
            <div
                class="bg-secondary/60 text-text/70 rounded-2xl border border-white/10 p-6 text-center text-sm"
            >
                Nikomu nic nedlužíš :)
            </div>
        {:else}
            <Table>
                <thead>
                    <Tr>
                        <Th class="text-left">Komu</Th>
                        <Th>Kolik</Th>
                        <Th></Th>
                    </Tr>
                </thead>
                <tbody class="text-center">
                    {#each Object.entries(grouppedData) as [who, list] (who)}
                        {@const user = data.users.find(
                            (user) => user.id === parseInt(who)
                        )!}
                        <Tr>
                            <Td class="text-left font-semibold">{formatUser(user)}</Td>
                            <Td class="font-bold text-rose-400">
                                {list
                                    .map((record) => parseFloat(record.price))
                                    .reduce((a, b) => a + b, 0)} Kč
                            </Td>
                            <Td>
                                <button
                                    type="button"
                                    onclick={() =>
                                        goto(
                                            `/${page.params.family}/debt/view/${user.id}`
                                        )}
                                    class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-400 transition-colors hover:bg-sky-500/25"
                                >
                                    <Icon name="bi-eye-fill" />
                                    <span>Detail / Zaplatit</span>
                                </button>
                            </Td>
                        </Tr>
                    {/each}
                </tbody>
            </Table>
        {/if}
    </div>

    <div class="flex flex-col gap-3">
        <Title class="text-lg lg:text-xl">Tobě je dluženo</Title>
        {#if whom.length === 0}
            <div
                class="bg-secondary/60 text-text/60 rounded-2xl border border-white/10 p-6 text-center text-sm"
            >
                Nikdo ti zatím nic nedluží.
            </div>
        {:else}
            <Table>
                <thead>
                    <Tr>
                        <Th class="text-left">Kdo</Th>
                        <Th>Kolik</Th>
                        <Th>Kdy</Th>
                        <Th>Zaplaceno</Th>
                        <Th></Th>
                    </Tr>
                </thead>
                <tbody class="text-center">
                    {#each whom as item (item.id)}
                        {@const user = data.users.find((user) => user.id === item.who)!}
                        <Tr>
                            <Td class="text-left font-semibold">{formatUser(user)}</Td>
                            <Td class="font-bold break-all"
                                >{parseFloat(item.price)} Kč</Td
                            >
                            <Td class="text-text/75 text-xs lg:text-sm"
                                >{toDate(item.when)}</Td
                            >
                            <Td>
                                {#if item.resolved_on === null}
                                    <span
                                        class="inline-flex rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300"
                                    >
                                        Čeká
                                    </span>
                                {:else}
                                    <span
                                        class="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400"
                                    >
                                        {toDate(item.resolved_on)}
                                    </span>
                                {/if}
                            </Td>
                            <Td>
                                <div class="flex items-center justify-center gap-1.5">
                                    <button
                                        type="button"
                                        onclick={() =>
                                            goto(
                                                `/${page.params.family}/debt/edit/${item.id}`
                                            )}
                                        class="text-text/80 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 transition-colors hover:bg-white/10"
                                        title="Upravit"
                                    >
                                        <Icon name="bi-pencil-fill" />
                                    </button>
                                    <button
                                        type="button"
                                        onclick={() => remove(item.id)}
                                        class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 text-red-400 transition-colors hover:bg-red-500/15"
                                        title="Smazat"
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
</div>
