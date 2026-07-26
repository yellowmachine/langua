<script lang="ts">
	import Navbar from '$lib/components/Navbar.svelte';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<Navbar user={data.user} />
{@render children()}
