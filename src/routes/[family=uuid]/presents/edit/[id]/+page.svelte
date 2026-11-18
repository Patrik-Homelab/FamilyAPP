<script lang="ts">
    import { Button, Entry, FileSelect, Input } from '$/components/form';
    import Title from '$/components/headers/Title.svelte';
    import Icon from '$/components/Icon.svelte';
    import { API } from '$/lib/api';
    import { extractError } from '$/lib/errors';
    import { SwalAlert } from '$/lib/functions';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import type { Snapshot } from '@sveltejs/kit';
    import type { PageData } from './$types';
    import Image from '$/components/Image.svelte';

    const { data: pageData }: { data: PageData } = $props();

    const fields = ['name', 'description', 'link', 'price', 'image'] as const;
    const defaultValues = [
        pageData.data.name,
        pageData.data.description ?? '',
        pageData.data.link ?? '',
        parseFloat(pageData.data.price),
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

    const handle = async () => {
        Object.values(data).forEach((item) => (item.error = undefined));

        if (data.name.value == '') {
            data.name.error = 'Zadej prosím název';
        }

        if (data.price.value <= 0) {
            data.price.error = 'Zadej prosím platnou cenu';
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
        if (data.name.value != pageData.data.name) {
            formData.set('name', data.name.value!.toString());
        }
        if (data.description.value != pageData.data.description) {
            formData.set('description', data.description.value);
        }
        if (data.link.value != pageData.data.link) {
            formData.set('link', data.link.value);
        }
        if (data.price.value != parseFloat(pageData.data.price)) {
            formData.set('price', data.price.value.toString());
        }
        if (imageDeleted && pageData.data.image) {
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

        const response = await API.presents.POST(formData);

        if (!response.status) {
            SwalAlert({
                icon: 'error',
                title: extractError(response.message)
            });
            return;
        }

        SwalAlert({
            icon: 'success',
            title: 'Dárek byl úspěšně upraven'
        });

        goto(`/${page.params.family}/presents/mine`);
    };

    let imageDeleted = $state(false);

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

<div class="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 py-4">
    <button
        type="button"
        onclick={() => goto(`/${page.params.family}/presents/mine`)}
        class="text-text/75 hover:text-text bg-secondary/70 inline-flex w-max cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-sm font-semibold transition-colors"
    >
        <Icon name="bi-arrow-return-left" />
        <span>Zpět na moje dárky</span>
    </button>

    <section
        class="bg-secondary/90 flex flex-col gap-4 rounded-2xl border border-white/10 p-6 shadow-xl"
    >
        <Title class="text-xl lg:text-2xl">Úprava dárku č.{pageData.data.id}</Title>
        <Entry id="name" label="Název" error={data.name.error}>
            <Input id="name" bind:value={data.name.value} invalid={data.name.error} />
        </Entry>
        <Entry
            id="description"
            label="Popis"
            note="(nepovinné)"
            error={data.description.error}
        >
            <Input
                id="description"
                bind:value={data.description.value}
                invalid={data.description.error}
            />
        </Entry>
        <Entry id="link" label="Odkaz" note="(nepovinné)" error={data.link.error}>
            <Input id="link" bind:value={data.link.value} invalid={data.link.error} />
        </Entry>
        <Entry id="price" label="Cena" error={data.price.error}>
            <Input
                id="price"
                type="number"
                step={0.00001}
                bind:value={data.price.value}
                invalid={data.price.error}
            />
        </Entry>
        {#if pageData.data.image && !imageDeleted}
            <div class="max-w-2xl">
                <h2 class="font-poppins text-lg font-bold 2xl:text-xl">
                    Aktuální obrázek <Icon
                        onclick={() => (imageDeleted = true)}
                        name="bi-trash-fill"
                        class="text-red-500"
                    />
                </h2>
                <Image name={pageData.data.image} alt="uploaded preview" />
            </div>
        {/if}
        <Entry id="image" label="Obrázek" note="(nepovinné)" error={data.image.error}>
            <FileSelect
                id="image"
                bind:value={data.image.value}
                accept="image/png, image/jpg, image/jpeg"
            />
        </Entry>

        <Button onclick={handle}>Uložit změny</Button>
    </section>
</div>
