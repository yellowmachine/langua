<script lang="ts">
	import Navbar from '$lib/components/Navbar.svelte';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<div class="flex h-dvh flex-col">
	<Navbar user={data.user} />
	<main class="min-h-0 flex-1">
		{@render children()}
	</main>
</div>
