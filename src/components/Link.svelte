<script lang="ts">
    import { resolveSvelteClass } from '$/lib/functions';
    import type { Snippet } from 'svelte';
    import type { ClassValue } from 'svelte/elements';
    import { twMerge } from 'tailwind-merge';

    const {
        children,
        link,
        class: cls = ''
    }: { children: Snippet; link: string; class?: ClassValue } = $props();
</script>

<a
    href={link}
    class={twMerge(
        'text-accent underline underline-offset-4 transition-colors hover:text-red-400',
        resolveSvelteClass(cls)
    )}
>
    {@render children()}
</a>
