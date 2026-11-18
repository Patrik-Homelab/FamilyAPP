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
    const _state = getState();

    const fields = [
        'username',
        'firstname',
        'lastname',
        'password',
        'password2'
    ] as const;
    type DataType = Record<(typeof fields)[number], { value: string; error?: string }>;

    const data = $state(
        Object.fromEntries(fields.map((item) => [item, { value: '' }])) as DataType
    );

    const register = async () => {
        Object.values(data).forEach((item) => (item.error = undefined));

        if (!data.username.value.trim()) {
            data.username.error = 'Vyplň prosím uživatelské jméno';
        }
        if (!data.firstname.value.trim()) {
            data.firstname.error = 'Vyplň prosím jméno';
        }
        if (!data.lastname.value.trim()) {
            data.lastname.error = 'Vyplň prosím příjmení';
        }
        if (!data.password.value.trim()) {
            data.password.error = 'Vyplň prosím heslo';
        }
        if (!data.password2.value.trim()) {
            data.password2.error = 'Vyplň prosím heslo znovu';
        } else if (data.password.value !== data.password2.value) {
            data.password2.error = 'Hesla se neshodují';
        }

        if (Object.values(data).some((item) => item.error !== undefined)) {
            return;
        }

        const response = await API.family.join({
            code: pageData.code,
            username: data.username.value.trim(),
            firstname: data.firstname.value.trim(),
            lastname: data.lastname.value.trim(),
            password: data.password.value.trim()
        });

        if (!response.status) {
            if (matchError(response.message, 'auth.register.username')) {
                data.username.error = extractError(response.message);
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
            title: 'Byl jsi úspěšně připojen k rodině'
        });

        _state.userState = {
            logged: true,
            data: response.data
        };

        goto(`/${response.data.family_uuid}`);
    };
</script>

<svelte:head>
    <title>Připojit se | FamilyAPP</title>
</svelte:head>

<div class="flex flex-1 flex-col items-center justify-center p-4">
    <section
        class="bg-secondary/90 flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
    >
        <div class="flex flex-col items-center gap-2 text-center">
            <div
                class="bg-accent/15 text-accent border-accent/30 flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl"
            >
                <Icon name="bi-people-fill" />
            </div>
            <Title class="text-center text-2xl lg:text-3xl">Připojení k rodině</Title>
            <p class="text-text/75 text-sm">
                Rodina: <strong class="text-text">{pageData.familyName}</strong> · Kód:
                <code class="bg-background rounded px-1.5 py-0.5 font-bold"
                    >{pageData.code}</code
                >
            </p>
        </div>

        <form
            onsubmit={(e) => {
                e.preventDefault();
                register();
            }}
            class="flex flex-col gap-3.5"
        >
            <Entry id="username" label="Uživatelské jméno" error={data.username.error}>
                <Input
                    id="username"
                    autocomplete="username"
                    bind:value={data.username.value}
                    invalid={data.username.error}
                />
            </Entry>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Entry id="firstname" label="Jméno" error={data.firstname.error}>
                    <Input
                        id="firstname"
                        autocomplete="given-name"
                        bind:value={data.firstname.value}
                        invalid={data.firstname.error}
                    />
                </Entry>
                <Entry id="lastname" label="Příjmení" error={data.lastname.error}>
                    <Input
                        id="lastname"
                        autocomplete="family-name"
                        bind:value={data.lastname.value}
                        invalid={data.lastname.error}
                    />
                </Entry>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Entry id="password" label="Heslo" error={data.password.error}>
                    <Input
                        id="password"
                        type="password"
                        autocomplete="new-password"
                        bind:value={data.password.value}
                        invalid={data.password.error}
                    />
                </Entry>
                <Entry id="password2" label="Heslo (znovu)" error={data.password2.error}>
                    <Input
                        id="password2"
                        type="password"
                        autocomplete="new-password"
                        bind:value={data.password2.value}
                        invalid={data.password2.error}
                    />
                </Entry>
            </div>
            <Button type="submit" class="mt-2">Vytvořit účet a vstoupit</Button>
        </form>
    </section>
</div>
<Footer version={pageData.version} />
