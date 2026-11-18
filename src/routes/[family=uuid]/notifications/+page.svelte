<script lang="ts">
    import { Button, Entry, Input, Select, TextArea } from '$/components/form';
    import Title from '$/components/headers/Title.svelte';
    import { API } from '$/lib/api';
    import { SwalAlert } from '$/lib/functions';
    import type { User } from '$/types/database';
    import type { Selectable } from 'kysely';

    import type { PageProps } from './$types';

    const { data }: PageProps = $props();

    let users = $state<
        (Omit<Selectable<User>, 'password'> & {
            group_id: number | null;
        })[]
    >([]);

    const resolveUsers = (userData: (typeof data)['users']) => {
        if (!userData.status) {
            SwalAlert({
                icon: 'error',
                title: 'Nepodařilo se načíst seznam uživatelů'
            });
            return;
        }

        users = userData.data;
    };

    resolveUsers(data.users);

    let selectedUserId = $state<string>('');
    let title = $state('');
    let body = $state('');
    let sending = $state(false);

    const sendNotification = async () => {
        if (!selectedUserId || selectedUserId === '') {
            SwalAlert({
                icon: 'error',
                title: 'Musíš vybrat uživatele'
            });
            return;
        }

        if (!title.trim()) {
            SwalAlert({
                icon: 'error',
                title: 'Musíš zadat nadpis'
            });
            return;
        }

        if (!body.trim()) {
            SwalAlert({
                icon: 'error',
                title: 'Musíš zadat zprávu'
            });
            return;
        }

        sending = true;

        try {
            const response = await API.notifications.send({
                userId: Number(selectedUserId),
                title: title.trim(),
                body: body.trim()
            });

            if (!response.status) {
                SwalAlert({
                    icon: 'error',
                    title: response.message
                });
                return;
            }

            SwalAlert({
                icon: 'success',
                title: 'Notifikace úspěšně odeslána'
            });

            // Reset form
            selectedUserId = '';
            title = '';
            body = '';
        } catch (err) {
            console.error(err);
            SwalAlert({
                icon: 'error',
                title: 'Něco se nepovedlo na serveru :('
            });
        } finally {
            sending = false;
        }
    };
</script>

<section class="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 pb-6">
    <Title>Tester notifikací</Title>

    <div
        class="bg-secondary/85 flex flex-col gap-4 rounded-2xl border border-white/10 p-5 shadow-md sm:p-6"
    >
        <Entry id="user-select" label="Vyberte uživatele">
            <Select id="user-select" bind:value={selectedUserId}>
                <option value="">-- Vyberte uživatele --</option>
                {#each users as user (user.id)}
                    <option value={user.id.toString()}>{user.username}</option>
                {/each}
            </Select>
        </Entry>

        <Entry id="title-input" label="Nadpis notifikace">
            <Input
                id="title-input"
                type="text"
                placeholder="Zadejte nadpis..."
                bind:value={title}
            />
        </Entry>

        <Entry id="body-input" label="Zpráva notifikace">
            <TextArea
                id="body-input"
                placeholder="Zadejte zprávu..."
                rows={4}
                bind:value={body}
            />
        </Entry>

        <div>
            <Button
                onclick={sendNotification}
                disabled={sending}
                class="w-full md:w-auto"
            >
                {sending ? 'Odesílání...' : 'Odeslat notifikaci'}
            </Button>
        </div>
    </div>
</section>
