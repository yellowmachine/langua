<script lang="ts">
	import Navbar from '$lib/components/Navbar.svelte';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<a
	href="#main"
	class="sr-only z-50 rounded-md bg-accent px-3 py-2 text-sm font-medium text-on-accent focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
>
	Saltar al contenido
</a>
<div class="flex h-dvh flex-col">
	<Navbar user={data.user} />
	<main id="main" tabindex="-1" class="min-h-0 flex-1 focus:outline-none">
		{@render children()}
	</main>
</div>
