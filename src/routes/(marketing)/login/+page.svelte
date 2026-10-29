<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
	<div>
		<h1 class="text-xl font-semibold">Langua</h1>
		<p class="text-sm" style:color="var(--color-ink-muted)">
			Inicia sesión para seguir practicando.
		</p>
	</div>

	<form method="POST" class="flex flex-col gap-4">
		{#if data.failed}
			<p class="text-sm text-red-600">No se ha podido entrar con Seilide. Inténtalo otra vez.</p>
		{/if}

		<button
			type="submit"
			class="rounded-md px-3 py-2 text-sm font-medium text-white"
			style:background-color="var(--color-accent)"
		>
			Entrar con Seilide
		</button>
	</form>
</div>
