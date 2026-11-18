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

<div class="h-full w-full flex-1 p-4 md:p-8">
    <h1 class="text-text mb-6 text-4xl font-bold">Rozvrhy</h1>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {#if loading}
            <div class="text-text col-span-full py-10 text-center opacity-50">
                Načítání...
            </div>
        {:else}
            <!-- My Timetable Card -->
            <a
                href="/{page.params.family}/timetable/{userId}"
                class="bg-secondary border-primary hover:bg-accent/10 hover:border-accent group block transform rounded-xl border p-6 transition-all hover:-translate-y-1"
            >
                <div class="flex items-center space-x-4">
                    <div
                        class="bg-primary text-secondary group-hover:bg-accent rounded-full p-4 transition-colors group-hover:text-white"
                    >
                        <i class="bi bi-person-lines-fill text-3xl"></i>
                    </div>
                    <div>
                        <h2 class="text-text text-xl font-bold">Můj rozvrh</h2>
                        <p class="text-text text-base opacity-70">Upravit a zobrazit</p>
                    </div>
                </div>
            </a>

            <!-- Other Users -->
            {#each users.filter((u) => u.id !== userId) as u (u.id)}
                <a
                    href="/{page.params.family}/timetable/{u.id}"
                    class="bg-secondary border-primary hover:bg-accent/10 hover:border-accent group block transform rounded-xl border p-6 transition-all hover:-translate-y-1"
                >
                    <div class="flex items-center space-x-4">
                        <div
                            class="bg-primary/20 text-primary group-hover:bg-accent rounded-full p-4 transition-colors group-hover:text-white"
                        >
                            <i class="bi bi-calendar3 text-3xl"></i>
                        </div>
                        <div>
                            <h2 class="text-text text-xl font-bold">
                                {u.firstname}
                                {u.lastname}
                            </h2>
                            <p class="text-text text-base opacity-70">@{u.username}</p>
                        </div>
                    </div>
                </a>
            {/each}
        {/if}
    </div>

    {#if !loading && users.length === 0}
        <div class="text-text mt-10 text-center opacity-70">
            <i class="bi bi-emoji-frown mb-2 block text-4xl"></i>
            <p>Zatím nikdo nemá vytvořený rozvrh.</p>
        </div>
    {/if}
</div>
