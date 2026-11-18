<script lang="ts">
    import { resolveSvelteClass } from '$/lib/functions';
    import type { SvelteHTMLElements } from 'svelte/elements';
    import { twMerge } from 'tailwind-merge';

    let {
        class: cls,
        value = $bindable(),
        invalid = $bindable(undefined),
        ...props
    }: SvelteHTMLElements['textarea'] & { invalid?: string } = $props();

    let el = $state<HTMLTextAreaElement>();
    $effect(() => {
        el?.setCustomValidity(invalid ?? '');
    });
</script>

<textarea
    bind:this={el}
    {...props}
    class={twMerge(
        'bg-background/75 text-text placeholder:text-text/40 focus:border-accent focus:ring-accent/25 w-full rounded-xl border border-white/15 px-3.5 py-2.5 text-base font-medium outline-hidden transition-all duration-150 invalid:border-red-500/80 focus:ring-2',
        resolveSvelteClass(cls ?? '')
    )}
    bind:value
></textarea>
