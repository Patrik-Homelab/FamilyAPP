<script lang="ts">
    import Link from '../Link.svelte';

    const { version }: { version: string } = $props();
</script>

<footer class="text-center font-bold">
    Created by <Link link="https://patrick115.eu">Patrik Mintěl</Link> verze <Link
        link="/changelog">{version}</Link
    >
</footer>
