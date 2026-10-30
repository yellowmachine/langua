<script lang="ts">
	import { fetchSpeechAudio } from '$lib/audio';
	import type { SpeechStyle } from '$lib/voices';

	let {
		text,
		language,
		style = 'conversation'
	}: { text: string; language?: string | null; style?: SpeechStyle } = $props();

	type Status = 'idle' | 'loading' | 'playing';

	let status = $state<Status>('idle');
	// Which of the two buttons started what is loading or playing.
	let slow = $state(false);
	let audio: HTMLAudioElement | undefined;

	function stop() {
		audio?.pause();
		if (audio) audio.currentTime = 0;
		status = 'idle';
	}

	async function toggle(wantSlow: boolean) {
		if (status === 'loading') return;
		if (status === 'playing') {
			stop();
			if (slow === wantSlow) return;
		}

		slow = wantSlow;
		status = 'loading';
		try {
			audio = (await fetchSpeechAudio(text, language, { style, slow: wantSlow })) ?? undefined;
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

	let normalStatus = $derived(slow ? 'idle' : status);
	let slowStatus = $derived(slow ? status : 'idle');
</script>

{#snippet spinner(size: string)}
	<svg
		class="{size} animate-spin"
		viewBox="0 0 24 24"
		fill="none"
		style:color="var(--color-accent)"
	>
		<circle class="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3"
		></circle>
		<path class="opacity-90" fill="currentColor" d="M12 3a9 9 0 0 1 9 9h-3a6 6 0 0 0-6-6V3Z" />
	</svg>
{/snippet}

{#snippet pause(size: string)}
	<svg class={size} viewBox="0 0 24 24" fill="white">
		<rect x="7" y="6" width="4" height="12" rx="1.2" />
		<rect x="13" y="6" width="4" height="12" rx="1.2" />
	</svg>
{/snippet}

<span class="inline-flex shrink-0 items-center gap-1">
	<button
		type="button"
		onclick={() => toggle(false)}
		aria-label={normalStatus === 'playing' ? 'Detener audio' : 'Escuchar'}
		class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors"
		style:border-color={normalStatus === 'playing' ? 'var(--color-accent)' : 'var(--color-border)'}
		style:background-color={normalStatus === 'playing' ? 'var(--color-accent)' : 'transparent'}
	>
		{#if normalStatus === 'loading'}
			{@render spinner('h-5 w-5')}
		{:else if normalStatus === 'playing'}
			{@render pause('h-5 w-5')}
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
	<button
		type="button"
		onclick={() => toggle(true)}
		aria-label={slowStatus === 'playing' ? 'Detener audio' : 'Repetir despacio'}
		title="Repetir despacio"
		class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors"
		style:border-color={slowStatus === 'playing' ? 'var(--color-accent)' : 'var(--color-border)'}
		style:background-color={slowStatus === 'playing' ? 'var(--color-accent)' : 'transparent'}
	>
		{#if slowStatus === 'loading'}
			{@render spinner('h-4 w-4')}
		{:else if slowStatus === 'playing'}
			{@render pause('h-4 w-4')}
		{:else}
			<!-- A turtle: shell, head and feet. -->
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" style:color="var(--color-accent)">
				<path fill="currentColor" d="M3.5 15.5a7 6 0 0 1 14 0Z" />
				<path
					stroke="var(--color-surface, white)"
					stroke-width="1.1"
					stroke-linecap="round"
					fill="none"
					d="M7.5 15.3l1.5-3.3h3l1.5 3.3M9 12l1.5-2.4L12 12"
				/>
				<circle cx="19.5" cy="13.5" r="2" fill="currentColor" />
				<path
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					d="M6 15.5v2.5M15 15.5v2.5M17.5 14.6l1-.6"
				/>
			</svg>
		{/if}
	</button>
</span>
