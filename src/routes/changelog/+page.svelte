<script lang="ts">
    import Title from '$/components/headers/Title.svelte';
    import Icon from '$/components/Icon.svelte';
    import showdown from 'showdown';
    import type { PageProps } from './$types';

    const { data }: PageProps = $props();

    const converter = new showdown.Converter();

    const htmls = data.changelog.map((md) => converter.makeHtml(md));
</script>

<div class="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 p-4 md:p-8">
    <div class="flex items-center justify-between">
        <Title>Seznam změn</Title>
        <a
            href="/"
            class="bg-secondary/80 hover:bg-secondary inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-sm font-semibold transition-colors"
        >
            <Icon name="bi-arrow-return-left" />
            <span>Zpět</span>
        </a>
    </div>

    <div class="flex flex-col gap-4">
        {#each htmls as html, index (index)}
            <article
                class="bg-secondary/80 prose prose-invert max-w-none rounded-2xl border border-white/10 p-5 shadow-sm"
            >
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html html}
            </article>
        {/each}
    </div>
</div>
