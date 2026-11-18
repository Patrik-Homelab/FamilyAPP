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

<section class="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 pb-6">
    <Title>Nastavení</Title>

    <div
        class="bg-secondary/85 flex flex-col gap-4 rounded-2xl border border-white/10 p-5 shadow-md sm:p-6"
    >
        <div>
            <h2 class="font-poppins text-xl font-bold">Bankovní účet</h2>
            <p class="text-text/65 mt-1 text-sm">
                Zadejte informace o vašem bankovním účtu pro generování QR kódů k platbám
            </p>
        </div>

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

            <div
                class="bg-background/50 flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm"
            >
                <span class="text-text/60 font-medium">Formát účtu:</span>
                <code class="font-bold">
                    {bankAccountPrefix || '0'}-{bankAccountNumber ||
                        'XXXXXXXXXX'}/{bankCode || 'XXXX'}
                </code>
            </div>

            <div>
                <Button onclick={saveSettings} class="w-full md:w-auto">
                    Uložit nastavení
                </Button>
            </div>
        </div>
    </div>
</section>
