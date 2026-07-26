<script lang="ts">
	import { fetchSpeechAudio } from '$lib/audio';

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
			audio = (await fetchSpeechAudio(text, language)) ?? undefined;
			if (!audio) {
				status = 'idle';
				return;
			}
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
	class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors"
	style:border-color={status === 'playing' ? 'var(--color-accent)' : 'var(--color-border)'}
	style:background-color={status === 'playing' ? 'var(--color-accent)' : 'transparent'}
>
	{#if status === 'loading'}
		<svg
			class="h-5 w-5 animate-spin"
			viewBox="0 0 24 24"
			fill="none"
			style:color="var(--color-accent)"
		>
			<circle class="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3"
			></circle>
			<path class="opacity-90" fill="currentColor" d="M12 3a9 9 0 0 1 9 9h-3a6 6 0 0 0-6-6V3Z" />
		</svg>
	{:else if status === 'playing'}
		<svg class="h-5 w-5" viewBox="0 0 24 24" fill="white">
			<rect x="7" y="6" width="4" height="12" rx="1.2" />
			<rect x="13" y="6" width="4" height="12" rx="1.2" />
		</svg>
	{:else}
		<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" style:color="var(--color-accent)">
			<path
				fill="currentColor"
				d="M12.75 5.6a.9.9 0 0 0-1.53-.64L7.2 8.9H4.4a.9.9 0 0 0-.9.9v4.4a.9.9 0 0 0 .9.9h2.8l4.02 3.94a.9.9 0 0 0 1.53-.64V5.6Z"
			/>
			<path
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
				fill="none"
				d="M16.3 9.3a4 4 0 0 1 0 5.6"
			/>
			<path
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
				fill="none"
				opacity="0.7"
				d="M18.7 7a7.4 7.4 0 0 1 0 10.2"
			/>
		</svg>
	{/if}
</button>
