<script lang="ts">
	import Footer from '$lib/components/Footer.svelte';

	let { children } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<div class="flex-1">
		{@render children()}
	</div>
	<Footer />
</div>
