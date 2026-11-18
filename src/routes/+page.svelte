<script lang="ts">
    import { Button, Entry, Input } from '$/components/form';
    import Title from '$/components/headers/Title.svelte';
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

<section
    class="md:border-accent md:bg-secondary flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 p-4 md:m-auto md:flex-0 md:rounded-md md:border-2 md:p-8"
>
    <div class="border-primary flex w-full justify-center gap-2 border-b pb-3">
        <button
            type="button"
            onclick={() => (activeTab = 'login')}
            class={[
                'cursor-pointer rounded-md px-3 py-1.5 font-bold transition-colors',
                activeTab === 'login'
                    ? 'bg-accent text-white'
                    : 'hover:bg-primary/30 text-text'
            ]}
        >
            Přihlášení
        </button>
        <button
            type="button"
            onclick={() => (activeTab = 'create')}
            class={[
                'cursor-pointer rounded-md px-3 py-1.5 font-bold transition-colors',
                activeTab === 'create'
                    ? 'bg-accent text-white'
                    : 'hover:bg-primary/30 text-text'
            ]}
        >
            Vytvořit rodinu
        </button>
        <button
            type="button"
            onclick={() => (activeTab = 'join')}
            class={[
                'cursor-pointer rounded-md px-3 py-1.5 font-bold transition-colors',
                activeTab === 'join'
                    ? 'bg-accent text-white'
                    : 'hover:bg-primary/30 text-text'
            ]}
        >
            Připojit se
        </button>
    </div>

    {#if activeTab === 'login'}
        <Title class="text-center text-3xl lg:text-4xl">Přihlášení</Title>
        <Entry id="username" label="Uživatelské jméno" error={loginData.username.error}>
            <Input
                id="username"
                bind:value={loginData.username.value}
                invalid={loginData.username.error}
            />
        </Entry>
        <Entry id="password" label="Heslo" error={loginData.password.error}>
            <Input
                id="password"
                type="password"
                bind:value={loginData.password.value}
                invalid={loginData.password.error}
            />
        </Entry>
        <Button onclick={login} class="w-1/2 md:hover:bg-red-500">Přihlásit se</Button>
    {:else if activeTab === 'create'}
        <Title class="text-center text-3xl lg:text-4xl">Vytvořit rodinu</Title>
        <Entry id="familyName" label="Název rodiny" error={createData.familyName.error}>
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
                bind:value={createData.username.value}
                invalid={createData.username.error}
            />
        </Entry>
        <Entry id="create-firstname" label="Jméno" error={createData.firstname.error}>
            <Input
                id="create-firstname"
                bind:value={createData.firstname.value}
                invalid={createData.firstname.error}
            />
        </Entry>
        <Entry id="create-lastname" label="Příjmení" error={createData.lastname.error}>
            <Input
                id="create-lastname"
                bind:value={createData.lastname.value}
                invalid={createData.lastname.error}
            />
        </Entry>
        <Entry id="create-password" label="Heslo" error={createData.password.error}>
            <Input
                id="create-password"
                type="password"
                bind:value={createData.password.value}
                invalid={createData.password.error}
            />
        </Entry>
        <Entry
            id="create-password2"
            label="Heslo (znovu)"
            error={createData.password2.error}
        >
            <Input
                id="create-password2"
                type="password"
                bind:value={createData.password2.value}
                invalid={createData.password2.error}
            />
        </Entry>
        <Button onclick={createFamily} class="w-2/3 md:hover:bg-red-500">
            Vytvořit rodinu a účet
        </Button>
    {:else}
        <Title class="text-center text-3xl lg:text-4xl">Připojit se k rodině</Title>
        <p class="text-center text-sm opacity-75">
            Zadej kód rodiny nebo kód pozvánky, který jsi dostal od správce rodiny.
        </p>
        <Entry id="joinCode" label="Kód rodiny / pozvánky" error={joinError}>
            <Input
                id="joinCode"
                placeholder="např. A1B2C3D4"
                bind:value={joinCode}
                invalid={joinError}
            />
        </Entry>
        <Button onclick={lookupJoinCode} class="w-1/2 md:hover:bg-red-500">
            Pokračovat
        </Button>
    {/if}
</section>
<Footer version={pageData.version} />
