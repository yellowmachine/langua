<script lang="ts">
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	async function persistTheme(state: { theme: string; dark: boolean; highContrast: boolean }) {
		const body = new FormData();
		body.set('theme', state.theme);
		body.set('dark', state.dark ? '1' : '0');
		body.set('highContrast', state.highContrast ? '1' : '0');
		await fetch('?/theme', {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true' },
			body
		});
	}
</script>

<div class="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-6">
	<header class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-semibold">Hola, {data.user.name}</h1>
			<p class="text-sm" style:color="var(--color-ink-muted)">
				{data.user.role === 'admin' ? 'Administrador' : 'Miembro'} ·
				{data.user.targetLanguage ?? 'sin idioma configurado todavía'}
			</p>
		</div>
		<form method="POST" action="?/logout">
			<button
				type="submit"
				class="rounded-md border px-3 py-1.5 text-sm"
				style:border-color="var(--color-border)"
			>
				Cerrar sesión
			</button>
		</form>
	</header>

	<section
		class="rounded-lg border p-4"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-surface)"
	>
		<h2 class="mb-3 text-sm font-medium">Apariencia</h2>
		<ThemePicker onPersist={persistTheme} />
	</section>
</div>
