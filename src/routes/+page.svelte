<script lang="ts">
    import { Button, Entry, Input } from '$/components/form';
    import Title from '$/components/headers/Title.svelte';
    import Icon from '$/components/Icon.svelte';
    import Footer from '$/components/navigation/Footer.svelte';
    import { API } from '$/lib/api';
    import { extractError, matchError } from '$/lib/errors';
    import { SwalAlert } from '$/lib/functions';
    import { getState } from '$/lib/state.svelte';
    import { goto } from '$app/navigation';
    import type { PageData } from './$types';

    const { data: pageData }: { data: PageData } = $props();

    type Tab = 'login' | 'create' | 'join';
    let activeTab = $state<Tab>('login');

    const _state = getState();

    // Login state
    const loginFields = ['username', 'password'] as const;
    type LoginData = Record<
        (typeof loginFields)[number],
        { value: string; error?: string }
    >;
    const loginData = $state(
        Object.fromEntries(loginFields.map((item) => [item, { value: '' }])) as LoginData
    );

    const login = async () => {
        Object.values(loginData).forEach((item) => (item.error = undefined));

        if (!loginData.username.value) {
            loginData.username.error = 'Vyplň prosím uživatelské jméno';
        }
        if (!loginData.password.value) {
            loginData.password.error = 'Vyplň prosím heslo';
        }
        if (Object.values(loginData).some((item) => item.error !== undefined)) {
            return;
        }

        const response = await API.auth.login({
            username: loginData.username.value,
            password: loginData.password.value
        });

        if (!response.status) {
            SwalAlert({
                icon: 'error',
                title: extractError(response.message)
            });

            if (matchError(response.message, 'auth.login.username')) {
                loginData.username.error = extractError(response.message);
            } else if (matchError(response.message, 'auth.login.password')) {
                loginData.password.error = extractError(response.message);
            }
            return;
        }

        SwalAlert({
            icon: 'success',
            title: 'Byl jsi úspěšně přihlášen'
        });

        _state.userState = {
            logged: true,
            data: response.data
        };

        goto(`/${response.data.family_uuid}`);
    };

    // Create family state
    const createFields = [
        'familyName',
        'username',
        'firstname',
        'lastname',
        'password',
        'password2'
    ] as const;
    type CreateData = Record<
        (typeof createFields)[number],
        { value: string; error?: string }
    >;
    const createData = $state(
        Object.fromEntries(
            createFields.map((item) => [item, { value: '' }])
        ) as CreateData
    );

    const createFamily = async () => {
        Object.values(createData).forEach((item) => (item.error = undefined));

        if (!createData.familyName.value.trim()) {
            createData.familyName.error = 'Vyplň prosím název rodiny';
        }
        if (!createData.username.value.trim()) {
            createData.username.error = 'Vyplň prosím uživatelské jméno';
        }
        if (!createData.firstname.value.trim()) {
            createData.firstname.error = 'Vyplň prosím jméno';
        }
        if (!createData.lastname.value.trim()) {
            createData.lastname.error = 'Vyplň prosím příjmení';
        }
        if (!createData.password.value.trim()) {
            createData.password.error = 'Vyplň prosím heslo';
        }
        if (!createData.password2.value.trim()) {
            createData.password2.error = 'Vyplň prosím heslo znovu';
        } else if (createData.password.value !== createData.password2.value) {
            createData.password2.error = 'Hesla se neshodují';
        }

        if (Object.values(createData).some((item) => item.error !== undefined)) {
            return;
        }

        const response = await API.family.create({
            familyName: createData.familyName.value.trim(),
            username: createData.username.value.trim(),
            firstname: createData.firstname.value.trim(),
            lastname: createData.lastname.value.trim(),
            password: createData.password.value.trim()
        });

        if (!response.status) {
            if (matchError(response.message, 'auth.register.username')) {
                createData.username.error = extractError(response.message);
            } else {
                SwalAlert({
                    icon: 'error',
                    title: extractError(response.message)
                });
            }
            return;
        }

        SwalAlert({
            icon: 'success',
            title: 'Rodina byla úspěšně vytvořena'
        });

        _state.userState = {
            logged: true,
            data: response.data
        };

        goto(`/${response.data.family_uuid}/family-settings`);
    };

    // Join family state
    let joinCode = $state('');
    let joinError = $state<string>();

    const lookupJoinCode = async () => {
        joinError = undefined;
        const clean = joinCode.trim();
        if (!clean) {
            joinError = 'Zadej prosím kód rodiny nebo pozvánky';
            return;
        }

        const response = await API.family.lookupCode({ code: clean });
        if (!response.status) {
            joinError = extractError(response.message);
            return;
        }

        if (response.data.type === 'invitation') {
            goto(`/invitation/${encodeURIComponent(response.data.code)}`);
        } else {
            goto(`/join/${encodeURIComponent(response.data.code)}`);
        }
    };
</script>

<svelte:head>
    <title>FamilyAPP</title>
</svelte:head>

<div class="flex flex-1 flex-col items-center justify-center p-4">
    <div class="mb-6 flex flex-col items-center gap-2 text-center">
        <div
            class="bg-accent/15 text-accent border-accent/30 flex h-14 w-14 items-center justify-center rounded-2xl border text-3xl shadow-lg"
        >
            <Icon name="bi-house-heart-fill" />
        </div>
        <h1 class="font-poppins text-3xl font-bold tracking-tight">FamilyAPP</h1>
        <p class="text-text/60 text-sm">Sdílený prostor pro vaši rodinu</p>
    </div>

    <section
        class="bg-secondary/90 flex w-full max-w-lg flex-col gap-5 rounded-2xl border border-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
    >
        <!-- Segmented Tabs -->
        <div
            class="bg-background/70 grid grid-cols-3 gap-1 rounded-xl border border-white/10 p-1"
        >
            <button
                type="button"
                onclick={() => (activeTab = 'login')}
                class={[
                    'cursor-pointer rounded-lg px-2 py-2 text-xs font-semibold transition-all sm:text-sm',
                    activeTab === 'login'
                        ? 'bg-accent text-white shadow-xs'
                        : 'text-text/70 hover:text-text hover:bg-white/5'
                ]}
            >
                Přihlášení
            </button>
            <button
                type="button"
                onclick={() => (activeTab = 'create')}
                class={[
                    'cursor-pointer rounded-lg px-2 py-2 text-xs font-semibold transition-all sm:text-sm',
                    activeTab === 'create'
                        ? 'bg-accent text-white shadow-xs'
                        : 'text-text/70 hover:text-text hover:bg-white/5'
                ]}
            >
                Nová rodina
            </button>
            <button
                type="button"
                onclick={() => (activeTab = 'join')}
                class={[
                    'cursor-pointer rounded-lg px-2 py-2 text-xs font-semibold transition-all sm:text-sm',
                    activeTab === 'join'
                        ? 'bg-accent text-white shadow-xs'
                        : 'text-text/70 hover:text-text hover:bg-white/5'
                ]}
            >
                Připojit se
            </button>
        </div>

        {#if activeTab === 'login'}
            <form
                onsubmit={(e) => {
                    e.preventDefault();
                    login();
                }}
                class="flex flex-col gap-4"
            >
                <Title class="text-center text-xl lg:text-2xl">Přihlášení k účtu</Title>
                <Entry
                    id="username"
                    label="Uživatelské jméno"
                    error={loginData.username.error}
                >
                    <Input
                        id="username"
                        autocomplete="username"
                        bind:value={loginData.username.value}
                        invalid={loginData.username.error}
                    />
                </Entry>
                <Entry id="password" label="Heslo" error={loginData.password.error}>
                    <Input
                        id="password"
                        type="password"
                        autocomplete="current-password"
                        bind:value={loginData.password.value}
                        invalid={loginData.password.error}
                    />
                </Entry>
                <Button type="submit" class="mt-1">Přihlásit se</Button>
            </form>
        {:else if activeTab === 'create'}
            <form
                onsubmit={(e) => {
                    e.preventDefault();
                    createFamily();
                }}
                class="flex flex-col gap-3.5"
            >
                <Title class="text-center text-xl lg:text-2xl"
                    >Vytvořit novou rodinu</Title
                >
                <Entry
                    id="familyName"
                    label="Název rodiny"
                    error={createData.familyName.error}
                >
                    <Input
                        id="familyName"
                        placeholder="např. Novákovi"
                        bind:value={createData.familyName.value}
                        invalid={createData.familyName.error}
                    />
                </Entry>
                <Entry
                    id="create-username"
                    label="Uživatelské jméno (admin)"
                    error={createData.username.error}
                >
                    <Input
                        id="create-username"
                        autocomplete="username"
                        bind:value={createData.username.value}
                        invalid={createData.username.error}
                    />
                </Entry>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Entry
                        id="create-firstname"
                        label="Jméno"
                        error={createData.firstname.error}
                    >
                        <Input
                            id="create-firstname"
                            autocomplete="given-name"
                            bind:value={createData.firstname.value}
                            invalid={createData.firstname.error}
                        />
                    </Entry>
                    <Entry
                        id="create-lastname"
                        label="Příjmení"
                        error={createData.lastname.error}
                    >
                        <Input
                            id="create-lastname"
                            autocomplete="family-name"
                            bind:value={createData.lastname.value}
                            invalid={createData.lastname.error}
                        />
                    </Entry>
                </div>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Entry
                        id="create-password"
                        label="Heslo"
                        error={createData.password.error}
                    >
                        <Input
                            id="create-password"
                            type="password"
                            autocomplete="new-password"
                            bind:value={createData.password.value}
                            invalid={createData.password.error}
                        />
                    </Entry>
                    <Entry
                        id="create-password2"
                        label="Heslo znovu"
                        error={createData.password2.error}
                    >
                        <Input
                            id="create-password2"
                            type="password"
                            autocomplete="new-password"
                            bind:value={createData.password2.value}
                            invalid={createData.password2.error}
                        />
                    </Entry>
                </div>
                <Button type="submit" class="mt-1">Vytvořit rodinu a účet</Button>
            </form>
        {:else}
            <form
                onsubmit={(e) => {
                    e.preventDefault();
                    lookupJoinCode();
                }}
                class="flex flex-col gap-4"
            >
                <Title class="text-center text-xl lg:text-2xl">Připojit se k rodině</Title
                >
                <p class="text-text/70 text-center text-sm">
                    Zadej kód rodiny nebo kód pozvánky, který jsi obdržel od správce.
                </p>
                <Entry id="joinCode" label="Kód rodiny / pozvánky" error={joinError}>
                    <Input
                        id="joinCode"
                        placeholder="např. A1B2C3D4"
                        bind:value={joinCode}
                        invalid={joinError}
                    />
                </Entry>
                <Button type="submit">Pokračovat</Button>
            </form>
        {/if}
    </section>
</div>
<Footer version={pageData.version} />
