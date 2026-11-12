<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	// Dashed pill for picking a ready-made option (templates, suggestions,
	// tags). `pressed` makes it a toggle (e.g. an active filter).
	let {
		pressed,
		class: className = '',
		children,
		...rest
	}: HTMLButtonAttributes & { pressed?: boolean; children: Snippet } = $props();

	let muted = $derived(pressed === false);
</script>

<button
	type="button"
	aria-pressed={pressed}
	class={[
		'min-h-8 rounded-full border border-dashed px-2.5 py-1 text-xs',
		muted ? 'border-border text-ink-muted' : 'border-accent text-accent',
		pressed && 'bg-surface font-medium',
		className
	]}
	{...rest}
>
	{@render children()}
</button>
