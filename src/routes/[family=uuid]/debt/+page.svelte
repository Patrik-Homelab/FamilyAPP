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
</script>

<div class="flex flex-1 flex-col">
    <Title class="my-2">Dlužíš</Title>
    {#if Object.values(grouppedData).length === 0}
        <h1 class="font-poppins text-center text-xl font-bold lg:text-2xl">
            Nikomu nic nedlužíš :)
        </h1>
    {:else}
        <Table>
            <thead>
                <Tr>
                    <Th>Komu</Th>
                    <Th>Kolik</Th>
                    <Th></Th>
                </Tr>
            </thead>
            <tbody class="text-center">
                {#each Object.entries(grouppedData) as [who, list] (who)}
                    {@const user = data.users.find((user) => user.id === parseInt(who))!}
                    <Tr>
                        <Td>{formatUser(user)}</Td>
                        <Td>
                            {list
                                .map((record) => parseFloat(record.price))
                                .reduce((a, b) => a + b, 0)}
                        </Td>
                        <Td>
                            <Icon
                                onclick={() =>
                                    goto(`/${page.params.family}/debt/view/${user.id}`)}
                                name="bi-eye-fill"
                                class="text-sky-500"
                            />
                        </Td>
                    </Tr>
                {/each}
            </tbody>
        </Table>
    {/if}
    <Title class="mt-12 mb-2">Tobě je dluženo</Title>
    <Table>
        <thead>
            <Tr>
                <Th>Kdo</Th>
                <Th>Kolik</Th>
                <Th>Kdy</Th>
                <Th>Zaplaceno</Th>
                <Th></Th>
            </Tr>
        </thead>
        <tbody class="text-center">
            <Tr>
                <Td colspan={5}>
                    <div class="flex w-full justify-center">
                        <Icon
                            onclick={() => goto(`/${page.params.family}/debt/new`)}
                            name="bi-plus-lg"
                            class="text-green-600"
                        />
                    </div>
                </Td>
            </Tr>
            {#each whom as item (item.id)}
                {@const user = data.users.find((user) => user.id === item.who)!}
                <Tr>
                    <Td>{formatUser(user)}</Td>
                    <Td class="break-all">{parseFloat(item.price)}</Td>
                    <Td>{toDate(item.when)}</Td>
                    <Td>{item.resolved_on === null ? 'Ne' : toDate(item.resolved_on)}</Td>
                    <Td>
                        <Icon
                            onclick={() =>
                                goto(`/${page.params.family}/debt/edit/${item.id}`)}
                            name="bi-pencil-fill"
                            class="text-gray-400"
                        />
                        <Icon
                            onclick={() => remove(item.id)}
                            name="bi-trash-fill"
                            class="text-red-500"
                        />
                    </Td>
                </Tr>
            {/each}
        </tbody>
    </Table>
</div>
