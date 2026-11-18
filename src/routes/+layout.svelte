<script lang="ts">
    import 'bootstrap-icons/font/bootstrap-icons.min.css';
    import '../app.css';
    import '../fonts.css';

    import { API } from '$/lib/api';
    import { logged, setState } from '$/lib/state.svelte';
    import { browser } from '$app/environment';
    import { onMount, type Snippet } from 'svelte';
    import type { LayoutData } from './$types';

    let { children, data }: { children: Snippet; data: LayoutData } = $props();

    API.hydrateFromServer(data.api);

    if (logged(data.userState)) {
        const _data = data.userState.data;
        if (data.permissions.status) {
            _data.permissions = data.permissions.data.permissions;
            _data.group = data.permissions.data.group;
            _data.family_name = data.permissions.data.family_name;
            _data.ha_enabled = data.permissions.data.ha_enabled;
        }
    }

    setState({
        userState: data.userState,
        title: '',
        pushEnabled: false
    });

    onMount(() => {
        if (browser && 'serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js', { scope: '/', updateViaCache: 'none' })
                .catch(() => {});
        }
    });
</script>

<main
    class="xl:font-xl bg-background font-roboto text-text flex h-full min-h-screen w-full flex-col overflow-x-hidden text-lg lg:text-xl"
>
    {@render children()}
</main>
