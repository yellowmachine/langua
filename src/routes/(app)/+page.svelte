<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import { LANGUAGES } from '$lib/languages';
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
		<div class="flex items-center gap-2">
			<a
				href={resolve('/chat')}
				class="rounded-md border px-3 py-1.5 text-sm"
				style:border-color="var(--color-border)"
			>
				Chat
			</a>
			<a
				href={resolve('/speak')}
				class="rounded-md border px-3 py-1.5 text-sm"
				style:border-color="var(--color-border)"
			>
				Hablar
			</a>
			<a
				href={resolve('/listen')}
				class="rounded-md border px-3 py-1.5 text-sm"
				style:border-color="var(--color-border)"
			>
				Escuchar
			</a>
			{#if data.user.role === 'admin'}
				<a
					href={resolve('/family')}
					class="rounded-md border px-3 py-1.5 text-sm"
					style:border-color="var(--color-border)"
				>
					Familia
				</a>
				<a
					href={resolve('/settings')}
					class="rounded-md border px-3 py-1.5 text-sm"
					style:border-color="var(--color-border)"
				>
					Ajustes
				</a>
			{/if}
			<form method="POST" action="?/logout">
				<button
					type="submit"
					class="rounded-md border px-3 py-1.5 text-sm"
					style:border-color="var(--color-border)"
				>
					Cerrar sesión
				</button>
			</form>
		</div>
	</header>

	<section
		class="rounded-lg border p-4"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-surface)"
	>
		<h2 class="mb-3 text-sm font-medium">Idioma</h2>
		<form method="POST" action="?/language" use:enhance class="flex flex-col gap-3 sm:flex-row">
			<label class="flex flex-1 flex-col gap-1 text-sm">
				Idioma nativo
				<select
					name="nativeLanguage"
					value={data.user.nativeLanguage ?? ''}
					class="rounded-md border px-3 py-2"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-background)"
				>
					<option value="">Sin especificar</option>
					{#each LANGUAGES as lang (lang.code)}
						<option value={lang.code}>{lang.label}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-1 flex-col gap-1 text-sm">
				Idioma que aprendo
				<select
					name="targetLanguage"
					value={data.user.targetLanguage ?? ''}
					class="rounded-md border px-3 py-2"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-background)"
				>
					<option value="">Sin especificar</option>
					{#each LANGUAGES as lang (lang.code)}
						<option value={lang.code}>{lang.label}</option>
					{/each}
				</select>
			</label>
			<button
				type="submit"
				class="self-end rounded-md px-3 py-2 text-sm font-medium text-white"
				style:background-color="var(--color-accent)"
			>
				Guardar
			</button>
		</form>
	</section>

	<section
		class="rounded-lg border p-4"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-surface)"
	>
		<h2 class="mb-3 text-sm font-medium">Apariencia</h2>
		<ThemePicker onPersist={persistTheme} />
	</section>
</div>
