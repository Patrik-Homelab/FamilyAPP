<script lang="ts">
    import { resolveSvelteClass } from '$/lib/functions';
    import type { Snippet } from 'svelte';
    import type { ClassValue } from 'svelte/elements';
    import { twMerge } from 'tailwind-merge';

    const { children, class: cls = '' }: { children: Snippet; class?: ClassValue } =
        $props();
</script>

<h1
    class={twMerge(
        'font-poppins text-text text-2xl font-bold tracking-tight lg:text-3xl',
        resolveSvelteClass(cls ?? '')
    )}
>
    {@render children()}
</h1>
