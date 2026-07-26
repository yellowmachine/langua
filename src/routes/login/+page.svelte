<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<div class="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
	<div>
		<h1 class="text-xl font-semibold">Langua</h1>
		<p class="text-sm" style:color="var(--color-ink-muted)">
			Inicia sesión para seguir practicando.
		</p>
	</div>

	<form method="POST" use:enhance class="flex flex-col gap-4">
		<label class="flex flex-col gap-1 text-sm">
			Usuario
			<input
				name="username"
				type="text"
				autocomplete="username"
				required
				class="rounded-md border px-3 py-2"
				style:border-color="var(--color-border)"
				style:background-color="var(--color-surface)"
			/>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			Contraseña
			<input
				name="password"
				type="password"
				autocomplete="current-password"
				required
				class="rounded-md border px-3 py-2"
				style:border-color="var(--color-border)"
				style:background-color="var(--color-surface)"
			/>
		</label>

		{#if form?.message}
			<p class="text-sm text-red-600">{form.message}</p>
		{/if}

		<button
			type="submit"
			class="rounded-md px-3 py-2 text-sm font-medium text-white"
			style:background-color="var(--color-accent)"
		>
			Entrar
		</button>
	</form>
</div>
