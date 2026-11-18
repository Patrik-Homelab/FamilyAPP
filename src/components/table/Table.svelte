<script lang="ts">
    import { resolveSvelteClass } from '$/lib/functions';
    import type { HTMLTableAttributes } from 'svelte/elements';
    import { twMerge } from 'tailwind-merge';

    let {
        children,
        class: cls,
        self = $bindable(),
        ...props
    }: HTMLTableAttributes & {
        self?: HTMLTableElement;
    } = $props();
</script>

<div
    class="bg-secondary/60 w-full overflow-x-auto rounded-xl border border-white/10 shadow-sm"
>
    <table
        bind:this={self}
        {...props}
        class={twMerge('w-full border-collapse text-left', resolveSvelteClass(cls ?? ''))}
    >
        {@render children?.()}
    </table>
</div>
