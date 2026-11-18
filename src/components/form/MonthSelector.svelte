<script lang="ts">
    import { resolveSvelteClass } from '$/lib/functions';
    import type { SvelteHTMLElements } from 'svelte/elements';
    import { twMerge } from 'tailwind-merge';
    let {
        class: cls = '',
        value = $bindable(''),
        ...props
    }: SvelteHTMLElements['select'] = $props();
</script>

<select
    class={twMerge(
        'bg-secondary text-text focus:border-accent cursor-pointer rounded-xl border border-white/15 px-3 py-1.5 text-base font-medium outline-hidden transition-colors',
        resolveSvelteClass(cls ?? '')
    )}
    bind:value
    {...props}
>
    <option value={0}>Leden</option>
    <option value={1}>Únor</option>
    <option value={2}>Březen</option>
    <option value={3}>Duben</option>
    <option value={4}>Květen</option>
    <option value={5}>Červen</option>
    <option value={6}>Červenec</option>
    <option value={7}>Srpen</option>
    <option value={8}>Září</option>
    <option value={9}>Říjen</option>
    <option value={10}>Listopad</option>
    <option value={11}>Prosinec</option>
</select>
