<script lang="ts">
	import { announcer } from '$lib/announcer.svelte';
	let {
		onTranscript,
		language,
		disabled = false
	}: {
		onTranscript: (text: string) => void;
		language?: string | null;
		disabled?: boolean;
	} = $props();

	const uid = $props.id();
	let status: 'idle' | 'recording' | 'transcribing' = $state('idle');
	// Shown (and announced) next to the button when something goes wrong.
	let failure = $state('');
	let mediaRecorder: MediaRecorder | undefined;
	let chunks: BlobPart[] = [];

	async function toggle() {
		if (status === 'recording') {
			mediaRecorder?.stop();
			return;
		}
		if (status === 'transcribing' || disabled) return;

		failure = '';
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			chunks = [];
			mediaRecorder = new MediaRecorder(stream);
			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunks.push(event.data);
			};
			mediaRecorder.onstop = async () => {
				stream.getTracks().forEach((track) => track.stop());
				status = 'transcribing';
				announcer.say('Transcribiendo…');

				const body = new FormData();
				body.set('audio', new Blob(chunks, { type: 'audio/webm' }), 'recording.webm');
				if (language) body.set('language', language);

				try {
					const response = await fetch('/transcribe', { method: 'POST', body });
					if (!response.ok) throw new Error(String(response.status));
					const { text } = (await response.json()) as { text: string };
					if (text) {
						onTranscript(text);
						announcer.say(`Texto reconocido: ${text}`);
					} else {
						failure = 'No se ha entendido nada. Prueba otra vez.';
					}
				} catch {
					failure = 'No se pudo transcribir la grabación.';
				} finally {
					status = 'idle';
				}
			};
			mediaRecorder.start();
			status = 'recording';
			announcer.say('Grabando');
		} catch {
			status = 'idle';
			failure = 'No se puede usar el micrófono. Revisa el permiso del navegador.';
		}
	}
</script>

<span class="relative inline-flex shrink-0">
	<button
		type="button"
		onclick={toggle}
		disabled={disabled || status === 'transcribing'}
		aria-label={status === 'recording'
			? 'Detener grabación'
			: status === 'transcribing'
				? 'Transcribiendo grabación'
				: 'Grabar mensaje de voz'}
		aria-describedby={failure ? `${uid}-failure` : undefined}
		class="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50"
		style:background-color={status === 'recording' ? 'var(--color-danger)' : 'var(--color-accent)'}
		style:color={status === 'recording' ? 'var(--color-on-danger)' : 'var(--color-on-accent)'}
	>
		{#if status === 'recording'}
			<span
				class="absolute inset-0 animate-ping rounded-full"
				style:background-color="var(--color-danger)"
				style:opacity="0.5"
			></span>
		{/if}
		<svg
			class="relative h-5 w-5"
			class:animate-spin={status === 'transcribing'}
			viewBox="0 0 24 24"
			fill="none"
		>
			{#if status === 'transcribing'}
				<circle class="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3"
				></circle>
				<path class="opacity-90" fill="currentColor" d="M12 3a9 9 0 0 1 9 9h-3a6 6 0 0 0-6-6V3z" />
			{:else if status === 'recording'}
				<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
			{:else}
				<path
					fill="currentColor"
					d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 0 0-7 0v5A3.5 3.5 0 0 0 12 15Z"
				/>
				<path
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					fill="none"
					d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3"
				/>
			{/if}
		</svg>
	</button>
	{#if failure}
		<span
			id="{uid}-failure"
			role="alert"
			class="absolute bottom-full left-0 z-10 mb-2 w-56 rounded-md border px-2 py-1 text-xs shadow"
			style:border-color="var(--color-border)"
			style:background-color="var(--color-background)"
			style:color="var(--color-danger)"
		>
			{failure}
		</span>
	{/if}
</span>
