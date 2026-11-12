<script lang="ts">
	// On/off toggle with its label beside it; the whole row is the target.
	let {
		checked,
		label,
		onchange,
		class: className = ''
	}: {
		checked: boolean;
		label: string;
		onchange: (checked: boolean) => void;
		class?: string;
	} = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	onclick={() => onchange(!checked)}
	class={['inline-flex min-h-10 items-center gap-2 text-sm', className]}
>
	<span class="text-ink-muted">{label}</span>
	<span
		class={[
			'relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors',
			checked ? 'border-accent bg-accent' : 'border-ink-muted bg-surface'
		]}
	>
		<span
			class={[
				'absolute top-0.5 h-4.5 w-4.5 rounded-full transition-transform motion-reduce:transition-none',
				checked ? 'translate-x-5.5 bg-on-accent' : 'translate-x-0.5 bg-ink-muted'
			]}
		></span>
	</span>
</button>
