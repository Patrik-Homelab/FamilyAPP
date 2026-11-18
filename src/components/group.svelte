<script lang="ts">
    import type { Snippet } from 'svelte';

    const {
        textColor,
        backgroundColor,
        children
    }: { textColor: string; backgroundColor: string; children: Snippet } = $props();
</script>

<span
    style="color: {textColor}; background-color:{backgroundColor};"
    class="font-poppins inline-flex items-center rounded-full border border-white/15 px-2.5 py-0.5 text-xs font-semibold shadow-xs"
>
    {@render children()}
</span>
