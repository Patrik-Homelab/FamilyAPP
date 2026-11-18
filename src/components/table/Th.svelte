<script lang="ts">
    import { resolveSvelteClass } from '$/lib/functions';
    import type { SvelteHTMLElements } from 'svelte/elements';
    import { twMerge } from 'tailwind-merge';

    const { children, class: cls, ...props }: SvelteHTMLElements['th'] = $props();
</script>

<th
    {...props}
    class={twMerge(
        'text-text/70 bg-white/[0.04] px-3 py-3 text-center text-xs font-semibold tracking-wider uppercase',
        resolveSvelteClass(cls ?? '')
    )}
>
    {@render children?.()}
</th>
