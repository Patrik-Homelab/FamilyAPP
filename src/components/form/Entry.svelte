<script lang="ts">
    import type { Snippet } from 'svelte';

    const {
        children,
        id = '',
        label,
        error = undefined,
        auto = false,
        note = '',
        row = false,
        small = false
    }: {
        children: Snippet;
        id?: string;
        label: string;
        error?: string;
        auto?: boolean;
        note?: string;
        row?: boolean;
        small?: boolean;
    } = $props();
</script>

<div
    class:w-full={!auto}
    class={{
        'flex flex-col': !row,
        'flex flex-row items-center justify-between gap-3': row
    }}
>
    <label
        class={[
            'text-text/85 font-semibold',
            !row ? 'mb-1.5' : '',
            !small ? 'text-sm lg:text-base' : 'text-xs lg:text-sm'
        ]}
        for={id}
    >
        {label}
        {#if note}
            <span class="text-text/50 ml-1 text-xs font-normal lg:text-sm">{note}</span>
        {/if}
    </label>
    {@render children()}
    {#if !row}
        <span class:hidden={!error} class="mt-1 text-xs font-medium text-red-400"
            >{error ?? ''}</span
        >
    {/if}
</div>
