<script lang="ts">
    import Link from '../Link.svelte';

    const { version }: { version: string } = $props();
</script>

<footer
    class="text-text/50 mt-auto border-t border-white/5 py-4 text-center text-xs font-medium"
>
    Created by <Link link="https://patrick115.eu">Patrik Mintěl</Link> · verze <Link
        link="/changelog">{version}</Link
    >
</footer>
