<script lang="ts">
    import { Button } from '$/components/form';
    import Title from '$/components/headers/Title.svelte';
    import Icon from '$/components/Icon.svelte';
    import { Table, Td, Th, Tr } from '$/components/table';
    import { API } from '$/lib/api';
    import { formatUser, SwalAlert, toDate } from '$/lib/functions';
    import type { DeArray } from '$/types/types';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import type { PageData } from './$types';
    import QRCode from 'qrcode';

    import type { PageProps } from './$types';

    const { data }: PageProps = $props();

    const intl = Intl.DateTimeFormat('cs-CZ', {
        month: 'long',
        year: 'numeric'
    });

    const groupData = (debts: (typeof data)['data']) => {
        return debts.reduce(
            (acc, item) => {
                const key = intl.format(new Date(item.when));
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key].push({ ...item, checked: false });
                return acc;
            },
            {} as Record<
                string,
                (DeArray<PageData['data']> & {
                    checked: boolean;
                })[]
            >
        );
    };

    let groupped = $state(groupData(data.data));

    const prices = $derived(
        Object.values(groupped).map((items) =>
            items.reduce(
                (acc, item) => (item.checked ? acc + parseFloat(item.price) : acc),
                0
            )
        )
    );
    const total = $derived(prices.reduce((acc, price) => acc + price, 0));

    const confirm = async () => {
        const confirm = await SwalAlert({
            toast: false,
            title: 'Opravdu chceš potvrdit vybrané dluhy jako vyřízené?',
            position: 'center',
            timer: 0,
            showConfirmButton: true,
            confirmButtonText: 'Ano',
            showCancelButton: true,
            cancelButtonText: 'Ne'
        });

        if (!confirm.isConfirmed) return;

        const response = await API.debt.POST({
            whom: parseInt(page.params.userId!),
            ids: Object.values(groupped)
                .flat()
                .filter((item) => item.checked)
                .map((item) => item.id)
        });

        if (!response.status) {
            SwalAlert({
                title: response.message,
                icon: 'error'
            });
            return;
        }
        SwalAlert({
            title: 'Dluhy byly úspěšně vyřízeny',
            icon: 'success'
        });

        if (response.data.length == 0) {
            goto(`/${page.params.family}/debt`);
            return;
        }

        //update
        groupped = groupData(response.data);
    };

    // Function to calculate IBAN check digits
    const calculateIBANCheckDigits = (countryCode: string, bban: string): string => {
        // Move country code to end and replace letters with numbers (A=10, B=11, etc.)
        const rearranged = bban + countryCode + '00';
        const numericString = rearranged
            .split('')
            .map((char) => {
                const code = char.charCodeAt(0);
                // If it's a letter (A-Z), convert to number (A=10, B=11, ..., Z=35)
                if (code >= 65 && code <= 90) {
                    return (code - 55).toString();
                }
                return char;
            })
            .join('');

        // Calculate mod 97
        let remainder = '';
        for (let i = 0; i < numericString.length; i++) {
            remainder += numericString[i];
            if (remainder.length >= 9) {
                remainder = (parseInt(remainder) % 97).toString();
            }
        }
        const mod = parseInt(remainder) % 97;
        const checkDigits = (98 - mod).toString().padStart(2, '0');
        return checkDigits;
    };

    // Function to generate Czech IBAN
    const generateCzechIBAN = (
        accountNumber: string,
        bankCode: string,
        prefix: string | null
    ): string => {
        // Validate inputs
        if (!accountNumber || !/^\d+$/.test(accountNumber)) {
            throw new Error('Invalid account number');
        }
        if (!bankCode || !/^\d{4}$/.test(bankCode)) {
            throw new Error('Invalid bank code');
        }
        if (prefix && !/^\d+$/.test(prefix)) {
            throw new Error('Invalid prefix');
        }

        // Format: bank code (4 digits) + account prefix (6 digits) + account number (10 digits)
        const paddedPrefix = (prefix || '0').padStart(6, '0');
        const paddedAccount = accountNumber.padStart(10, '0');
        const bban = bankCode + paddedPrefix + paddedAccount;
        const checkDigits = calculateIBANCheckDigits('CZ', bban);
        return `CZ${checkDigits}${bban}`;
    };

    const downloadQR = async () => {
        if (!data.userInfo.bank_account_number || !data.userInfo.bank_code) {
            SwalAlert({
                title: 'Uživatel nemá nastaven bankovní účet',
                icon: 'error'
            });
            return;
        }

        const amount = total;
        const accountNumber = data.userInfo.bank_account_number;
        const bankCode = data.userInfo.bank_code;
        const prefix = data.userInfo.bank_account_prefix || null;

        // Generate IBAN from Czech account details
        const iban = generateCzechIBAN(accountNumber, bankCode, prefix);

        // Czech payment QR code format (SPAYD) with IBAN
        const qrData = `SPD*1.0*ACC:${iban}*AM:${amount.toFixed(2)}*CC:CZK`;

        try {
            const qrDataUrl = await QRCode.toDataURL(qrData, {
                width: 512,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });

            // Create download link
            const link = document.createElement('a');
            link.href = qrDataUrl;
            // Sanitize filename to remove invalid characters
            const sanitizedAccountNumber = accountNumber.replace(/[^a-zA-Z0-9]/g, '');
            const sanitizedAmount = amount.toFixed(2).replace('.', '_');
            link.download = `platba_${sanitizedAmount}CZK_${sanitizedAccountNumber}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            SwalAlert({
                title: 'QR kód byl úspěšně stažen',
                icon: 'success'
            });
        } catch (err) {
            console.error(err);
            SwalAlert({
                title: 'Nepodařilo se vygenerovat QR kód',
                icon: 'error'
            });
        }
    };

    const hasBankAccount = $derived(
        data.userInfo.bank_account_number && data.userInfo.bank_code
    );
</script>

<section class="flex flex-1 flex-col gap-2">
    <div class="flex w-full items-center">
        <Icon
            onclick={() => goto(`/${page.params.family}/debt`)}
            name="bi-arrow-return-left"
            class="text-2xl lg:text-3xl"
        />
        <Title class="mx-auto">Dlužení {formatUser(data.userInfo)}</Title>
    </div>

    <div class="flex items-center justify-between">
        <h2>Vybráno celkem: {total} Kč</h2>
        <div class="flex gap-2">
            {#if hasBankAccount}
                <Button onclick={downloadQR} disabled={total === 0} class="w-auto">
                    Stáhnout QR
                </Button>
            {/if}
            <Button onclick={confirm} disabled={total === 0} class="w-auto"
                >Potvrdit</Button
            >
        </div>
    </div>

    <Table>
        <thead>
            <Tr>
                <Th colspan={2}>Měsíc</Th>
                <Th colspan={2}>Vybraná částka</Th>
            </Tr>
        </thead>
        <tbody class="text-center">
            {#each Object.entries(groupped) as [month, items], idx (idx)}
                <Tr>
                    <Td colspan={2}>{month}</Td>
                    <Td colspan={2}>{prices[idx]} Kč</Td>
                </Tr>
                <Tr>
                    <Td
                        ><input
                            type="checkbox"
                            onchange={(ev) =>
                                items.forEach(
                                    (item) => (item.checked = ev.currentTarget.checked)
                                )}
                        /></Td
                    >
                    <Td>Datum</Td>
                    <Td>Částka</Td>
                    <Td>Obrázek</Td>
                </Tr>

                {#each items as item (item.id)}
                    <Tr>
                        <Td><input type="checkbox" bind:checked={item.checked} /></Td>
                        <Td>{toDate(item.when)}</Td>
                        <Td>{parseFloat(item.price)} Kč</Td>
                        <Td>
                            {#if item.photo}
                                <a
                                    class="break-all text-sky-600"
                                    href="/images/{item.photo}"
                                    target="_blank">{item.photo}</a
                                >
                            {:else}
                                -
                            {/if}
                        </Td>
                    </Tr>
                {/each}
            {/each}
        </tbody>
    </Table>
</section>
