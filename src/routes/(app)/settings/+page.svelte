<script lang="ts">
	import { enhance } from '$app/forms';
	import { LANGUAGES } from '$lib/languages';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	function languageLabel(code: string | null) {
		if (!code) return 'sin idioma configurado todavía';
		return LANGUAGES.find((lang) => lang.code === code)?.label ?? code;
	}
</script>

<div class="mx-auto flex max-w-2xl flex-col gap-8 p-6">
	<header>
		<h1 class="text-xl font-semibold">Ajustes</h1>
	</header>

	<section
		class="rounded-lg border p-4"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-surface)"
	>
		<h2 class="mb-3 text-sm font-medium">Miembros</h2>
		<ul class="flex flex-col gap-2">
			{#each data.members as member (member.id)}
				<li class="flex items-center justify-between text-sm">
					<span
						>{member.name}
						<span style:color="var(--color-ink-muted)">@{member.username}</span></span
					>
					<span style:color="var(--color-ink-muted)">
						{member.role === 'admin' ? 'Administrador' : 'Miembro'} · {languageLabel(
							member.targetLanguage
						)}
					</span>
				</li>
			{/each}
		</ul>
	</section>

	<section
		class="rounded-lg border p-4"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-surface)"
	>
		<h2 class="mb-3 text-sm font-medium">Añadir miembro</h2>
		<form method="POST" action="?/addMember" use:enhance class="flex flex-col gap-4">
			<label class="flex flex-col gap-1 text-sm">
				Nombre
				<input
					name="name"
					type="text"
					required
					class="rounded-md border px-3 py-2"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-background)"
				/>
			</label>

			<label class="flex flex-col gap-1 text-sm">
				Usuario
				<input
					name="username"
					type="text"
					required
					class="rounded-md border px-3 py-2"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-background)"
				/>
			</label>

			<label class="flex flex-col gap-1 text-sm">
				Contraseña
				<input
					name="password"
					type="password"
					autocomplete="new-password"
					required
					minlength="8"
					class="rounded-md border px-3 py-2"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-background)"
				/>
			</label>

			<label class="flex flex-col gap-1 text-sm">
				Idioma que va a aprender
				<select
					name="targetLanguage"
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

			{#if form?.formId === 'addMember' && form.message}
				<p class="text-sm text-red-600">{form.message}</p>
			{/if}

			<button
				type="submit"
				class="self-start rounded-md px-3 py-2 text-sm font-medium text-white"
				style:background-color="var(--color-accent)"
			>
				Crear cuenta
			</button>
		</form>
	</section>

	<section
		class="rounded-lg border p-4"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-surface)"
	>
		<h2 class="mb-1 text-sm font-medium">Chat con IA</h2>
		<p class="mb-3 text-sm" style:color="var(--color-ink-muted)">
			{#if data.aiMode === 'cloud'}
				Usando OpenRouter (cloud) con la API key configurada.
			{:else if data.hasOpenRouterKey}
				Tienes una API key guardada, pero el chat sigue usando el modelo local (Ollama). Activa el
				modo cloud abajo para usarla.
			{:else}
				Sin API key configurada: el chat usa el modelo local (Ollama), sin coste ni envío de datos a
				terceros.
			{/if}
		</p>

		<form method="POST" action="?/save" use:enhance class="flex flex-col gap-3">
			<label class="flex flex-col gap-1 text-sm">
				API key de OpenRouter
				<div class="flex items-center gap-2">
					<input
						name="apiKey"
						type="password"
						autocomplete="off"
						placeholder={data.hasOpenRouterKey ? '•••••••••••••• (ya configurada)' : 'sk-or-...'}
						class="flex-1 rounded-md border px-3 py-2"
						style:border-color="var(--color-border)"
						style:background-color="var(--color-background)"
					/>
					{#if data.hasOpenRouterKey}
						<button type="submit" name="deleteKey" value="on" class="text-sm text-red-600">
							Eliminar
						</button>
					{/if}
				</div>
			</label>

			<fieldset class="flex flex-col gap-1 text-sm">
				<legend class="mb-1">Modo</legend>
				<label class="flex items-center gap-2">
					<input type="radio" name="mode" value="local" checked={data.aiMode === 'local'} />
					Local (Ollama)
				</label>
				<label
					class="flex items-center gap-2"
					class:opacity-50={!data.hasOpenRouterKey}
					title={!data.hasOpenRouterKey ? 'Guarda una API key para poder activarlo' : undefined}
				>
					<input
						type="radio"
						name="mode"
						value="cloud"
						checked={data.aiMode === 'cloud'}
						disabled={!data.hasOpenRouterKey}
					/>
					Cloud (OpenRouter)
				</label>
			</fieldset>

			{#if form?.formId === 'save' && form.message}
				<p class="text-sm text-red-600">{form.message}</p>
			{/if}

			<button
				type="submit"
				class="w-fit rounded-md px-3 py-2 text-sm font-medium text-white"
				style:background-color="var(--color-accent)"
			>
				Guardar
			</button>
		</form>
	</section>
</div>
