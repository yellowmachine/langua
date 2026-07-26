<script lang="ts">
	let { text, language }: { text: string; language?: string | null } = $props();

	let status: 'idle' | 'loading' | 'playing' = $state('idle');
	let audio: HTMLAudioElement | undefined;

	async function toggle() {
		if (status === 'playing' && audio) {
			audio.pause();
			audio.currentTime = 0;
			status = 'idle';
			return;
		}
		if (status === 'loading') return;

		status = 'loading';
		try {
			const response = await fetch('/tts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text, language })
			});
			if (!response.ok) {
				status = 'idle';
				return;
			}
			const blob = await response.blob();
			audio = new Audio(URL.createObjectURL(blob));
			audio.onended = () => (status = 'idle');
			status = 'playing';
			await audio.play();
		} catch {
			status = 'idle';
		}
	}
</script>

<button
	type="button"
	onclick={toggle}
	aria-label={status === 'playing' ? 'Detener audio' : 'Escuchar'}
	class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full opacity-80 hover:opacity-100"
>
	{#if status === 'loading'}
		<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
			></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
		</svg>
	{:else if status === 'playing'}
		<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
			<rect x="6" y="5" width="4" height="14" rx="1" />
			<rect x="14" y="5" width="4" height="14" rx="1" />
		</svg>
	{:else}
		<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
			<path d="M11 5 6 9H3v6h3l5 4V5z" />
			<path
				d="M15.5 8.5a5 5 0 0 1 0 7"
				stroke="currentColor"
				stroke-width="1.5"
				fill="none"
				stroke-linecap="round"
			/>
		</svg>
	{/if}
</button>
