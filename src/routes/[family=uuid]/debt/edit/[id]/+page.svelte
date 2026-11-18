<script lang="ts">
    import { Button, Entry, FileSelect, Input, Select } from '$/components/form';
    import Title from '$/components/headers/Title.svelte';
    import Icon from '$/components/Icon.svelte';
    import Image from '$/components/Image.svelte';
    import { API } from '$/lib/api.js';
    import { extractError, matchError } from '$/lib/errors.js';
    import { formatUser, SwalAlert, toLocalDateString } from '$/lib/functions.js';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import type { Snapshot } from '@sveltejs/kit';
    import type { PageData } from './$types.js';

    const { data: pageData }: { data: PageData } = $props();

    const fields = ['who', 'amount', 'when', 'image'] as const;
    const defaultValues = [
        pageData.data.who as null | number,
        parseFloat(pageData.data.price),
        toLocalDateString(pageData.data.when),
        [] as (File | null)[]
    ] as const;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Indices<T extends readonly any[]> = Exclude<keyof T, keyof []>;

    type DataType = {
        [Index in Indices<typeof fields> as (typeof fields)[Index]]: {
            value: (typeof defaultValues)[Index];
            error?: string;
        };
    };
    let data = $state(
        Object.fromEntries(
            fields.map((item, idx) => [item, { value: defaultValues[idx] }])
        ) as DataType
    );

    let imageDeleted = $state(false);

    const handle = async () => {
        Object.values(data).forEach((item) => (item.error = undefined));

        if (
            data.who.value == null ||
            !pageData.users.map((user) => user.id).includes(data.who.value)
        ) {
            data.who.error = 'Vyber prosím uživatele';
        }

        if (data.amount.value <= 0) {
            data.amount.error = 'Vyber prosím částku';
        }

        if (data.when.value == '') {
            data.when.error = 'Vyber prosím čas';
        }

        const files = data.image.value.filter((file) => file !== null);

        if (files.length > 1) {
            data.image.error = 'Vyber prosím jen jeden obrázek';
        }

        if (Object.values(data).some((item) => item.error !== undefined)) {
            return;
        }

        //only set updated values
        const formData = new FormData();
        if (data.who.value != pageData.data.who) {
            formData.set('who', data.who.value!.toString());
        }
        if (data.amount.value != parseFloat(pageData.data.price)) {
            formData.set('amount', data.amount.value.toString());
        }
        if (data.when.value != toLocalDateString(pageData.data.when)) {
            formData.set('when', data.when.value);
        }
        if (imageDeleted && pageData.data.photo) {
            formData.set('image', 'deleted');
        }
        if (files.length == 1) {
            formData.set('image', files[0]);
        }

        if (Array.from(formData.keys()).length === 0) {
            SwalAlert({
                icon: 'info',
                title: 'Nebyla provedena žádná změna'
            });

            return;
        }

        formData.set('id', pageData.data.id.toString());

        const response = await API.debt.PATCH(formData);

        if (!response.status) {
            if (matchError(response.message, 'debt.input')) {
                SwalAlert({
                    icon: 'error',
                    title: extractError(response.message)
                });
            } else if (matchError(response.message, 'debt.negative')) {
                data.amount.error = extractError(response.message);
            } else if (matchError(response.message, 'debt.file')) {
                data.image.error = extractError(response.message);
            } else if (matchError(response.message, 'debt.size')) {
                data.image.error = extractError(response.message);
            } else if (matchError(response.message, 'debt.range')) {
                data.amount.error = extractError(response.message);
            } else {
                SwalAlert({
                    icon: 'error',
                    title: response.message
                });
            }

            return;
        }

        SwalAlert({
            icon: 'success',
            title: 'Dluh upraven'
        });

        goto(`/${page.params.family}/debt`);
    };

    export const snapshot = {
        capture: () => {
            return data;
        },
        restore: (value) => {
            data = {
                ...value,
                image: {
                    value: []
                }
            };
        }
    } satisfies Snapshot<Omit<DataType, 'image'>>;
</script>

<Icon
    onclick={() => goto(`/${page.params.family}/debt`)}
    name="bi-arrow-return-left"
    class="text-2xl lg:text-3xl"
/>
<section
    class="md:border-accent md:bg-secondary flex flex-1 flex-col items-center justify-center gap-4 p-4 md:m-auto md:flex-0 md:rounded-md md:border-2 md:p-8"
>
    <Title>Úprava dlužení č.{pageData.data.id}</Title>
    <Entry id="who" label="Dlužník" error={data.who.error}>
        <Select id="who" bind:value={data.who.value} invalid={data.who.error}>
            <option value={null} selected disabled>Vyber dlužníka</option>
            {#each pageData.users as user (user.id)}
                <option value={user.id}>{formatUser(user)}</option>
            {/each}
        </Select>
    </Entry>
    <Entry
        id="amount"
        label="Částka"
        note="(používá se desetinná tečka)"
        error={data.amount.error}
    >
        <Input
            id="amount"
            type="number"
            step={0.00001}
            bind:value={data.amount.value}
            invalid={data.amount.error}
        />
    </Entry>
    <Entry
        id="when"
        label="Kdy"
        note="(proběhla například platba/placení)"
        error={data.when.error}
    >
        <Input
            id="when"
            type="datetime-local"
            bind:value={data.when.value}
            invalid={data.when.error}
        />
    </Entry>
    {#if pageData.data.photo && !imageDeleted}
        <div class="max-w-2xl">
            <h2 class="font-poppins text-lg font-bold 2xl:text-xl">
                Aktuální obrázek <Icon
                    onclick={() => (imageDeleted = true)}
                    name="bi-trash-fill"
                    class="text-red-500"
                />
            </h2>
            <Image name={pageData.data.photo} alt="uploaded preview" />
        </div>
    {/if}
    <Entry id="img" label="Obrázek" note="(nepovinné)" error={data.image.error}>
        <FileSelect
            id="img"
            bind:value={data.image.value}
            accept="image/png, image/jpg, image/jpeg"
        />
    </Entry>

    <Button onclick={handle}>Upravit</Button>
</section>
