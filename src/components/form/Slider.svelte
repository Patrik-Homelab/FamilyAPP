<script lang="ts">
    import type { HTMLInputAttributes } from 'svelte/elements';

    let {
        value = $bindable(),
        id,
        invalid,
        ...props
    }: HTMLInputAttributes & { invalid?: string } = $props();

    let el = $state<HTMLInputElement>();
    $effect(() => {
        el?.setCustomValidity(invalid ?? '');
    });

    if (!id) {
        id = 'slider-default';
    }
</script>

<label for={id} class="inline-flex cursor-pointer items-center">
    <input
        bind:this={el}
        {id}
        bind:checked={value}
        class="peer sr-only"
        {...props}
        type="checkbox"
    />
    <div
        class="peer-checked:bg-accent/90 peer-checked:border-accent relative h-7 w-12 rounded-full border border-white/20 bg-white/10 p-0.5 transition-colors duration-200 before:block before:h-5.5 before:w-5.5 before:rounded-full before:bg-white before:shadow-sm before:transition-transform before:duration-200 before:content-[''] peer-checked:before:translate-x-5"
    ></div>
</label>
