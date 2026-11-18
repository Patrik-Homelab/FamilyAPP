<script lang="ts">
    import { API } from '$lib/api';
    import { getState } from '$lib/state.svelte';
    import { page } from '$app/state';
    import { onMount } from 'svelte';

    let users = $state<
        { id: number; username: string; firstname: string; lastname: string }[]
    >([]);
    let loading = $state(true);

    const appState = getState();
    // const isLogged = logged(appState.userState);
    const userId = appState.userState.logged ? appState.userState.data.id : null;

    onMount(async () => {
        const res = await API.timetable.GET();
        if (res.status) {
            users = res.data;
        }
        loading = false;
    });
</script>

<div class="flex flex-1 flex-col gap-6 pb-6">
    <h1 class="font-poppins text-2xl font-bold tracking-tight lg:text-3xl">Rozvrhy</h1>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#if loading}
            <div class="text-text/55 col-span-full py-10 text-center text-sm">
                Načítání...
            </div>
        {:else}
            <!-- My Timetable Card -->
            <a
                href="/{page.params.family}/timetable/{userId}"
                class="bg-secondary/80 hover:bg-secondary group hover:border-accent/40 flex items-center gap-4 rounded-2xl border border-white/10 p-5 shadow-xs transition-all duration-150 hover:-translate-y-0.5"
            >
                <div
                    class="bg-accent/15 text-accent border-accent/30 group-hover:bg-accent flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-2xl transition-colors group-hover:text-white"
                >
                    <i class="bi bi-person-lines-fill"></i>
                </div>
                <div>
                    <h2 class="font-poppins text-lg font-bold">Můj rozvrh</h2>
                    <p class="text-text/60 text-sm">Upravit a zobrazit</p>
                </div>
            </a>

            <!-- Other Users -->
            {#each users.filter((u) => u.id !== userId) as u (u.id)}
                <a
                    href="/{page.params.family}/timetable/{u.id}"
                    class="bg-secondary/80 hover:bg-secondary group flex items-center gap-4 rounded-2xl border border-white/10 p-5 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-white/20"
                >
                    <div
                        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/15 text-2xl text-sky-400 transition-colors group-hover:bg-sky-500 group-hover:text-white"
                    >
                        <i class="bi bi-calendar3"></i>
                    </div>
                    <div class="min-w-0">
                        <h2 class="font-poppins truncate text-lg font-bold">
                            {u.firstname}
                            {u.lastname}
                        </h2>
                        <p class="text-text/60 truncate text-sm">@{u.username}</p>
                    </div>
                </a>
            {/each}
        {/if}
    </div>

    {#if !loading && users.length === 0}
        <div
            class="bg-secondary/60 text-text/65 rounded-2xl border border-white/10 p-8 text-center text-sm"
        >
            <i class="bi bi-emoji-frown mb-2 block text-3xl"></i>
            <p>Zatím nikdo nemá vytvořený rozvrh.</p>
        </div>
    {/if}
</div>
