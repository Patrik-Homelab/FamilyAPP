<script lang="ts">
    import { resolveSvelteClass } from '$/lib/functions';
    import type { HTMLSelectAttributes } from 'svelte/elements';
    import { twMerge } from 'tailwind-merge';

    let {
        children,
        class: cls,
        value = $bindable(),
        invalid = $bindable(undefined),
        ...props
    }: HTMLSelectAttributes & { invalid?: string } = $props();

    let el = $state<HTMLSelectElement>();

    $effect(() => {
        el?.setCustomValidity(invalid ?? '');
    });
</script>

<select
    bind:this={el}
    {...props}
    class={twMerge(
        'bg-background/75 text-text focus:border-accent focus:ring-accent/25 w-full cursor-pointer rounded-xl border border-white/15 px-3.5 py-2.5 text-base font-medium outline-hidden transition-all duration-150 invalid:border-red-500/80 focus:ring-2',
        resolveSvelteClass(cls ?? '')
    )}
    bind:value
>
    {@render children?.()}
</select>
