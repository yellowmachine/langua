<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { themeStore } from '$lib/theme.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { children } = $props();

	onMount(() => {
		// The inline script in app.html already applied the right classes
		// before paint; this just syncs the reactive store to match.
		themeStore.initFromDOM();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="flex min-h-screen flex-col">
	<div class="flex-1">
		{@render children()}
	</div>
	<Footer />
</div>
