<script lang="ts">
    import { resolveSvelteClass } from '$/lib/functions';
    import type { SvelteHTMLElements } from 'svelte/elements';
    import { twMerge } from 'tailwind-merge';

    const { children, class: cls, ...props }: SvelteHTMLElements['td'] = $props();
</script>

<td
    {...props}
    class={twMerge('px-3 py-3 text-sm lg:text-base', resolveSvelteClass(cls ?? ''))}
>
    {@render children?.()}
</td>
