<script lang="ts">
    import { resolveSvelteClass } from '$/lib/functions';
    import type { SvelteHTMLElements } from 'svelte/elements';
    import { twMerge } from 'tailwind-merge';

    const { children, class: cls, ...props }: SvelteHTMLElements['tr'] = $props();
</script>

<tr
    {...props}
    class={twMerge(
        'border-t border-white/10 transition-colors hover:bg-white/[0.03]',
        resolveSvelteClass(cls ?? '')
    )}
>
    {@render children?.()}
</tr>
