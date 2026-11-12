<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	// The app's buttons: one look per variant, themed through the colour
	// tokens (so dark mode and high contrast just work). Layout classes
	// (w-fit, self-end…) go in `class`.
	let {
		variant = 'primary',
		size = 'md',
		pressed,
		type = 'button',
		class: className = '',
		children,
		...rest
	}: HTMLButtonAttributes & {
		variant?: 'primary' | 'secondary' | 'danger' | 'danger-outline';
		size?: 'sm' | 'md';
		/** Makes it a toggle button (aria-pressed), highlighted while on. */
		pressed?: boolean;
		children: Snippet;
	} = $props();

	const VARIANTS = {
		primary: 'bg-accent text-on-accent font-medium',
		secondary: 'border border-border',
		danger: 'bg-danger text-on-danger font-medium',
		'danger-outline': 'border border-border text-danger'
	};
	const SIZES = {
		sm: 'min-h-8 px-2.5 py-1 text-xs',
		md: 'min-h-10 px-3 py-2 text-sm'
	};
</script>

<button
	{type}
	aria-pressed={pressed}
	class={[
		'inline-flex items-center justify-center gap-1.5 rounded-md transition-opacity disabled:opacity-60',
		// Two border colours at once would be decided by CSS order: pick one.
		pressed ? 'border border-accent text-accent' : VARIANTS[variant],
		SIZES[size],
		className
	]}
	{...rest}
>
	{@render children()}
</button>
