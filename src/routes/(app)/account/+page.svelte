<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<div class="mx-auto flex max-w-2xl flex-col gap-8 p-6">
	<header>
		<h1 class="text-xl font-semibold">Mi cuenta</h1>
	</header>

	<section
		class="rounded-lg border p-4"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-surface)"
	>
		<h2 class="mb-3 text-sm font-medium">Cambiar contraseña</h2>
		<form method="POST" action="?/changePassword" use:enhance class="flex flex-col gap-4">
			<label class="flex flex-col gap-1 text-sm">
				Contraseña actual
				<input
					name="currentPassword"
					type="password"
					autocomplete="current-password"
					required
					class="rounded-md border px-3 py-2"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-background)"
				/>
			</label>

			<label class="flex flex-col gap-1 text-sm">
				Nueva contraseña
				<input
					name="newPassword"
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
				Repite la nueva contraseña
				<input
					name="confirmPassword"
					type="password"
					autocomplete="new-password"
					required
					minlength="8"
					class="rounded-md border px-3 py-2"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-background)"
				/>
			</label>

			{#if form?.message}
				<p class="text-sm text-red-600">{form.message}</p>
			{/if}
			{#if form?.success}
				<p class="text-sm" style:color="var(--color-accent)">Contraseña actualizada.</p>
			{/if}

			<button
				type="submit"
				class="self-start rounded-md px-3 py-2 text-sm font-medium text-white"
				style:background-color="var(--color-accent)"
			>
				Guardar
			</button>
		</form>
	</section>
</div>
