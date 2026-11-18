<script lang="ts">
    import { resolveSvelteClass } from '$/lib/functions';
    import type { HTMLButtonAttributes } from 'svelte/elements';
    import { twMerge } from 'tailwind-merge';

    const { children, class: cls, ...props }: HTMLButtonAttributes = $props();
</script>

<button
    {...props}
    class={twMerge(
        'bg-accent font-poppins inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:brightness-110 focus:ring-2 focus:ring-red-400/40 focus:outline-hidden active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:grayscale',
        resolveSvelteClass(cls ?? '')
    )}
>
    {@render children?.()}
</button>
