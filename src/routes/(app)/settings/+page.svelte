<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
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
				<input
					name="apiKey"
					type="password"
					autocomplete="off"
					placeholder={data.hasOpenRouterKey ? '•••••••••••••• (ya configurada)' : 'sk-or-...'}
					class="rounded-md border px-3 py-2"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-background)"
				/>
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

			{#if form?.message}
				<p class="text-sm text-red-600">{form.message}</p>
			{/if}

			<div class="flex gap-2">
				<button
					type="submit"
					class="rounded-md px-3 py-2 text-sm font-medium text-white"
					style:background-color="var(--color-accent)"
				>
					Guardar
				</button>
				<button
					type="submit"
					formaction="?/setMode"
					class="rounded-md border px-3 py-2 text-sm"
					style:border-color="var(--color-border)"
				>
					Guardar modo
				</button>
				{#if data.hasOpenRouterKey}
					<button
						type="submit"
						formaction="?/clear"
						class="rounded-md border px-3 py-2 text-sm"
						style:border-color="var(--color-border)"
					>
						Quitar y volver a local
					</button>
				{/if}
			</div>
		</form>
	</section>
</div>
