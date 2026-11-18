<script lang="ts">
    import { Button, Entry, Input, Select } from '$/components/form';
    import Title from '$/components/headers/Title.svelte';
    import { API } from '$/lib/api';
    import { BANK_CODES } from '$/lib/bankCodes';
    import { SwalAlert } from '$/lib/functions';
    import { onMount } from 'svelte';

    let bankAccountPrefix = $state<string>('');
    let bankAccountNumber = $state<string>('');
    let bankCode = $state<string>('');

    onMount(async () => {
        const response = await API.users.bankSettings.GET();
        if (response.status && response.data) {
            bankAccountPrefix = response.data.bank_account_prefix ?? '';
            bankAccountNumber = response.data.bank_account_number ?? '';
            bankCode = response.data.bank_code ?? '';
        }
    });

    const saveSettings = async () => {
        // Client-side validation
        const prefix = bankAccountPrefix.trim();
        const accountNumber = bankAccountNumber.trim();
        const code = bankCode.trim();

        // Validate prefix format if provided
        if (prefix && !/^\d{1,6}$/.test(prefix)) {
            SwalAlert({
                icon: 'error',
                title: 'Předčíslí musí obsahovat pouze číslice (max 6)'
            });
            return;
        }

        // Validate account number format if provided
        if (accountNumber && !/^\d{2,10}$/.test(accountNumber)) {
            SwalAlert({
                icon: 'error',
                title: 'Číslo účtu musí obsahovat pouze číslice (2-10 číslic)'
            });
            return;
        }

        // Validate bank code format if provided
        if (code && !/^\d{4}$/.test(code)) {
            SwalAlert({
                icon: 'error',
                title: 'Kód banky musí obsahovat právě 4 číslice'
            });
            return;
        }

        // Validate that account number and bank code are provided together
        if ((accountNumber && !code) || (!accountNumber && code)) {
            SwalAlert({
                icon: 'error',
                title: 'Číslo účtu a kód banky musí být zadány společně'
            });
            return;
        }

        const response = await API.users.bankSettings.PATCH({
            bank_account_prefix: prefix || null,
            bank_account_number: accountNumber || null,
            bank_code: code || null
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
            title: 'Nastavení bankovního účtu bylo úspěšně uloženo'
        });
    };
</script>

<section class="flex flex-1 flex-col gap-4 p-4">
    <Title>Nastavení</Title>

    <div class="bg-secondary rounded-lg p-4 shadow-md">
        <h2 class="mb-4 text-xl font-bold">Bankovní účet</h2>
        <p class="mb-4 text-sm opacity-75">
            Zadejte informace o vašem bankovním účtu pro generování QR kódů k platbám
        </p>

        <div class="flex flex-col gap-4">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Entry label="Předčíslí">
                    <Input
                        type="text"
                        bind:value={bankAccountPrefix}
                        placeholder="např. 19"
                    />
                </Entry>
                <Entry label="Číslo účtu">
                    <Input
                        type="text"
                        bind:value={bankAccountNumber}
                        placeholder="např. 2000145399"
                    />
                </Entry>
                <Entry label="Kód banky">
                    <Select bind:value={bankCode}>
                        <option value="" selected>Vyberte banku</option>
                        {#each BANK_CODES as bank (bank.code)}
                            <option value={bank.code}>{bank.code} - {bank.name}</option>
                        {/each}
                    </Select>
                </Entry>
            </div>

            <div class="text-sm opacity-75">
                <strong>Formát účtu:</strong>
                {bankAccountPrefix || '0'}-{bankAccountNumber ||
                    'XXXXXXXXXX'}/{bankCode || 'XXXX'}
            </div>

            <Button onclick={saveSettings} class="w-full md:w-auto">
                Uložit nastavení
            </Button>
        </div>
    </div>
</section>
