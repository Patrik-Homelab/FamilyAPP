<script lang="ts">
    import { Button, FileSelect, Input } from '$/components/form';
    import Entry from '$/components/form/Entry.svelte';
    import Title from '$/components/headers/Title.svelte';
    import Icon from '$/components/Icon.svelte';
    import { API } from '$/lib/api';
    import { extractError } from '$/lib/errors';
    import { SwalAlert } from '$/lib/functions';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';

    const fields = ['name', 'count', 'image'] as const;
    const defaultValues = ['', 1, [] as (File | null)[]] as const;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Indices<T extends readonly any[]> = Exclude<keyof T, keyof []>;

    type DataType = {
        [Index in Indices<typeof fields> as (typeof fields)[Index]]: {
            value: (typeof defaultValues)[Index];
            error?: string;
        };
    };
    const data = $state(
        Object.fromEntries(
            fields.map((item, idx) => [item, { value: defaultValues[idx] }])
        ) as DataType
    );

    const handle = async () => {
        Object.values(data).forEach((item) => (item.error = undefined));

        if (data.name.value == '') {
            data.name.error = 'Zadej prosím název';
        }

        if (data.count.value <= 0) {
            data.count.error = 'Zadej prosím počet';
        }

        const files = data.image.value.filter((file) => file !== null);

        if (files.length > 1) {
            data.image.error = 'Vyber prosím jen jeden obrázek';
        }

        if (Object.values(data).some((item) => item.error !== undefined)) {
            return;
        }

        const formData = new FormData();
        formData.set('name', data.name.value);
        formData.set('count', data.count.value.toString());
        if (files.length == 1) {
            formData.set('image', files[0]);
        }

        const response = await API.shoppinglist.PUT(formData);

        if (!response.status) {
            SwalAlert({
                title: extractError(response.message),
                icon: 'error'
            });
            return;
        }

        SwalAlert({
            title: 'Položka byla úspěšně přidána',
            icon: 'success'
        });

        goto(`/${page.params.family}/shoppinglist`);
    };
</script>

<Icon
    onclick={() => goto(`/${page.params.family}/shoppinglist`)}
    name="bi-arrow-return-left"
    class="text-2xl lg:text-3xl"
/>
<section
    class="md:border-accent md:bg-secondary flex flex-1 flex-col items-center justify-center gap-4 p-4 md:m-auto md:flex-0 md:rounded-md md:border-2 md:p-8"
>
    <Title>Nová položka</Title>
    <Entry id="name" label="Název" error={data.name.error}>
        <Input id="name" bind:value={data.name.value} invalid={data.name.error} />
    </Entry>
    <Entry id="count" label="Počet" error={data.count.error}>
        <Input
            id="count"
            type="number"
            bind:value={data.count.value}
            invalid={data.count.error}
        />
    </Entry>
    <Entry id="image" label="Obrázek" note="(nepovinné)" error={data.image.error}>
        <FileSelect id="image" bind:value={data.image.value} accept="image/*" />
    </Entry>
    <Button onclick={handle}>Přidat</Button>
</section>
