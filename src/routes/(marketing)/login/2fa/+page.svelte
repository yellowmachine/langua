<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let useBackupCode = $derived(form?.useBackupCode ?? false);
</script>

<div class="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
	<div>
		<h1 class="text-xl font-semibold">Verificación en dos pasos</h1>
		<p class="text-sm" style:color="var(--color-ink-muted)">
			{#if useBackupCode}
				Introduce uno de tus códigos de recuperación. Cada código solo sirve una vez.
			{:else}
				Introduce el código de 6 dígitos de tu app de autenticación.
			{/if}
		</p>
	</div>

	<form method="POST" use:enhance class="flex flex-col gap-4">
		<input type="hidden" name="method" value={useBackupCode ? 'backup' : 'totp'} />

		<label class="flex flex-col gap-1 text-sm">
			{useBackupCode ? 'Código de recuperación' : 'Código'}
			{#if useBackupCode}
				<input
					name="code"
					type="text"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					required
					class="rounded-md border px-3 py-2 font-mono"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-surface)"
				/>
			{:else}
				<input
					name="code"
					type="text"
					inputmode="numeric"
					autocomplete="one-time-code"
					pattern="[0-9 ]*"
					maxlength="7"
					required
					class="rounded-md border px-3 py-2 font-mono tracking-widest"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-surface)"
				/>
			{/if}
		</label>

		<label class="flex items-center gap-2 text-sm">
			<input name="trustDevice" type="checkbox" />
			Confiar en este dispositivo durante 30 días
		</label>

		{#if form?.message}
			<p class="text-sm text-red-600">{form.message}</p>
		{/if}

		<button
			type="submit"
			class="rounded-md px-3 py-2 text-sm font-medium text-white"
			style:background-color="var(--color-accent)"
		>
			Verificar
		</button>
	</form>

	<div class="flex justify-between text-sm">
		<button
			type="button"
			class="underline"
			style:color="var(--color-ink-muted)"
			onclick={() => (useBackupCode = !useBackupCode)}
		>
			{useBackupCode ? 'Usar la app de autenticación' : 'Usar un código de recuperación'}
		</button>
		<a href={resolve('/login')} class="underline" style:color="var(--color-ink-muted)">Volver</a>
	</div>
</div>
