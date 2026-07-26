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
			{#if data.hasOpenRouterKey}
				Usando OpenRouter (cloud) con la API key configurada.
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
