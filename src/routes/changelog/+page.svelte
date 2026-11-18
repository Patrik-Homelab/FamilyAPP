<script lang="ts">
    import showdown from 'showdown';

    import type { PageProps } from './$types';

    const { data }: PageProps = $props();

    const converter = new showdown.Converter();

    const htmls = data.changelog.map((md) => converter.makeHtml(md));
</script>

<div
    class="divide-primary prose prose-invert mx-auto flex w-full flex-1 flex-col gap-2 divide-y text-lg"
>
    {#each htmls as html, index (index)}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <div>{@html html}</div>
    {/each}
</div>
