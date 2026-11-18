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

<section
    class="md:border-accent md:bg-secondary flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 p-4 md:m-auto md:flex-0 md:rounded-md md:border-2 md:p-8"
>
    <Title class="text-center text-3xl lg:text-4xl">Připojení k rodině</Title>
    <h3 class="text-center">
        Rodina: <strong>{pageData.familyName}</strong> (kód:
        <strong>{pageData.code}</strong>)
    </h3>
    <Entry id="username" label="Uživatelské jméno" error={data.username.error}>
        <Input
            id="username"
            bind:value={data.username.value}
            invalid={data.username.error}
        />
    </Entry>
    <Entry id="firstname" label="Jméno" error={data.firstname.error}>
        <Input
            id="firstname"
            bind:value={data.firstname.value}
            invalid={data.firstname.error}
        />
    </Entry>
    <Entry id="lastname" label="Příjmení" error={data.lastname.error}>
        <Input
            id="lastname"
            bind:value={data.lastname.value}
            invalid={data.lastname.error}
        />
    </Entry>
    <Entry id="password" label="Heslo" error={data.password.error}>
        <Input
            id="password"
            type="password"
            bind:value={data.password.value}
            invalid={data.password.error}
        />
    </Entry>
    <Entry id="password2" label="Heslo (znovu)" error={data.password2.error}>
        <Input
            id="password2"
            type="password"
            bind:value={data.password2.value}
            invalid={data.password2.error}
        />
    </Entry>
    <Button onclick={register} class="w-1/2 md:hover:bg-red-500">
        Vytvořit účet a vstoupit
    </Button>
</section>
<Footer version={pageData.version} />
