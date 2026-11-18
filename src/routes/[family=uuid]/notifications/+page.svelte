<script lang="ts">
    import { Button, Input, Select, TextArea } from '$/components/form';
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

<div class="mt-2 h-full w-full flex-1">
    <div class="flex flex-col gap-4 p-4">
        <h1 class="font-poppins text-2xl font-bold">Tester notifikací</h1>

        <div class="flex flex-col gap-2">
            <label for="user-select" class="font-poppins text-xl font-bold">
                Vyberte uživatele:
            </label>
            <Select id="user-select" bind:value={selectedUserId}>
                <option value="">-- Vyberte uživatele --</option>
                {#each users as user (user.id)}
                    <option value={user.id.toString()}>{user.username}</option>
                {/each}
            </Select>
        </div>

        <div class="flex flex-col gap-2">
            <label for="title-input" class="font-poppins text-xl font-bold">
                Nadpis notifikace:
            </label>
            <Input
                id="title-input"
                type="text"
                placeholder="Zadejte nadpis..."
                bind:value={title}
            />
        </div>

        <div class="flex flex-col gap-2">
            <label for="body-input" class="font-poppins text-xl font-bold">
                Zpráva notifikace:
            </label>
            <TextArea
                id="body-input"
                placeholder="Zadejte zprávu..."
                rows={5}
                bind:value={body}
            />
        </div>

        <Button onclick={sendNotification} disabled={sending}>
            {sending ? 'Odesílání...' : 'Odeslat notifikaci'}
        </Button>
    </div>
</div>
