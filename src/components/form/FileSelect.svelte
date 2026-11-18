<script lang="ts">
    import { twMerge } from 'tailwind-merge';
    import { Entry, Slider } from '.';
    import Icon from '../Icon.svelte';
    import Image from '../Image.svelte';

    let {
        id = '',
        value = $bindable([]),
        class: cls = '',
        accept = '',
        multiple = false
    }: {
        id?: string;
        value: (File | null)[];
        class?: string;
        accept?: string;
        multiple?: boolean;
    } = $props();

    let input: HTMLInputElement;

    const imageMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/bmp',
        'image/webp',
        'image/tiff',
        'image/svg+xml',
        'image/x-icon',
        'image/heif',
        'image/heic'
    ];

    let fileInfos = $state<
        (
            | {
                  image: false;
                  name: string;
                  size: number;
              }
            | {
                  image: true;
                  name: string;
                  size: number;
                  data: string;
              }
        )[]
    >([]);

    const onchange = () => {
        value = Array.from(input.files!);
        fileInfos = value
            .filter((f) => f !== null)
            .map((file) => {
                if (!imageMimeTypes.includes(file.type)) {
                    return {
                        image: false,
                        name: file.name,
                        size: file.size
                    };
                }

                return {
                    image: true,
                    name: file.name,
                    size: file.size,
                    data: URL.createObjectURL(file)
                };
            });
    };

    const onclick = () => {
        input.click();
    };

    const onkeypress = (
        ev: KeyboardEvent & {
            currentTarget: EventTarget & HTMLDivElement;
        }
    ) => {
        if (ev.key !== 'Enter') return;

        input.click();
    };

    const sufixes = {
        TB: 1000 * 1000 * 1000 * 1000,
        GB: 1000 * 1000 * 1000,
        MB: 1000 * 1000,
        KB: 1000,
        B: 1
    };

    const formatSize = (size: number) => {
        for (const [suffix, minSize] of Object.entries(sufixes)) {
            if (size >= minSize) {
                return (size / minSize).toFixed(2) + suffix;
            }
        }

        return '';
    };

    let capture = $state(false);
</script>

<input
    bind:this={input}
    {id}
    class="h-0 w-0 opacity-0"
    type="file"
    {onchange}
    {accept}
    {multiple}
    capture={capture ? 'environment' : undefined}
/>

<section class="flex flex-col gap-3">
    <Entry id="input-capture" label="Použít fotoaparát" row={true} small={true}>
        <Slider id="input-capture" bind:value={capture} />
    </Entry>

    <div
        tabindex={0}
        role="button"
        {onclick}
        {onkeypress}
        class={twMerge(
            'bg-background/50 hover:border-accent/60 hover:bg-secondary/60 flex w-full cursor-pointer flex-wrap items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/20 p-5 text-center transition-all',
            cls
        )}
    >
        {#if value.length == 0}
            <div class="flex flex-col items-center gap-1.5 py-2">
                <Icon name="bi-cloud-arrow-up" class="text-accent text-3xl" />
                <span class="font-poppins text-base font-semibold">
                    Vybrat soubor{#if multiple}y{/if}
                </span>
                <span class="text-text/50 text-xs">
                    Klikni pro výběr obrázku nebo souboru
                </span>
            </div>
        {:else}
            {#each fileInfos as file (`${file.name}-${file.size}`)}
                <div
                    class="bg-secondary/80 flex flex-col overflow-hidden rounded-xl border border-white/15 shadow-sm"
                >
                    {#if file.image}
                        <div class="mx-auto h-auto max-w-64">
                            <Image name={file.data} alt="File preview" />
                        </div>
                    {/if}
                    <div class="flex flex-col items-center border-t border-white/10 p-2">
                        <h1 class="text-sm font-semibold break-all">
                            {file.name}
                        </h1>
                        <h2 class="text-text/60 text-xs">
                            {formatSize(file.size)}
                        </h2>
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</section>
