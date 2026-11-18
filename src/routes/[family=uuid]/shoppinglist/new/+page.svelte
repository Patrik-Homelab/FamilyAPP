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

<div class="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 py-4">
    <button
        type="button"
        onclick={() => goto(`/${page.params.family}/shoppinglist`)}
        class="text-text/75 hover:text-text bg-secondary/70 inline-flex w-max cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-sm font-semibold transition-colors"
    >
        <Icon name="bi-arrow-return-left" />
        <span>Zpět na nákupní seznam</span>
    </button>

    <section
        class="bg-secondary/90 flex flex-col gap-4 rounded-2xl border border-white/10 p-6 shadow-xl"
    >
        <Title class="text-xl lg:text-2xl">Nová položka</Title>
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
        <Button onclick={handle}>Přidat na seznam</Button>
    </section>
</div>
