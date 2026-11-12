<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Entrar · Langua</title></svelte:head>

<div class="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
	<div>
		<h1 class="text-xl font-semibold">Langua</h1>
		<p class="text-sm" style:color="var(--color-ink-muted)">
			Inicia sesión para seguir practicando.
		</p>
	</div>

	<form method="POST" class="flex flex-col gap-4">
		{#if data.failed}
			<p class="text-sm text-danger">No se ha podido entrar con Seilide. Inténtalo otra vez.</p>
		{/if}

		<Button type="submit">Entrar con Seilide</Button>
	</form>
</div>
