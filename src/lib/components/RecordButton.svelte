<script lang="ts">
	let {
		onTranscript,
		language,
		disabled = false
	}: {
		onTranscript: (text: string) => void;
		language?: string | null;
		disabled?: boolean;
	} = $props();

	let status: 'idle' | 'recording' | 'transcribing' = $state('idle');
	let mediaRecorder: MediaRecorder | undefined;
	let chunks: BlobPart[] = [];

	async function toggle() {
		if (status === 'recording') {
			mediaRecorder?.stop();
			return;
		}
		if (status === 'transcribing' || disabled) return;

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

				const body = new FormData();
				body.set('audio', new Blob(chunks, { type: 'audio/webm' }), 'recording.webm');
				if (language) body.set('language', language);

				try {
					const response = await fetch('/transcribe', { method: 'POST', body });
					if (response.ok) {
						const { text } = (await response.json()) as { text: string };
						if (text) onTranscript(text);
					}
				} finally {
					status = 'idle';
				}
			};
			mediaRecorder.start();
			status = 'recording';
		} catch {
			status = 'idle';
		}
	}
</script>

<button
	type="button"
	onclick={toggle}
	disabled={disabled || status === 'transcribing'}
	aria-label={status === 'recording' ? 'Detener grabación' : 'Grabar mensaje de voz'}
	class="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50"
	style:background-color={status === 'recording' ? '#dc2626' : 'var(--color-accent)'}
>
	{#if status === 'recording'}
		<span
			class="absolute inset-0 animate-ping rounded-full"
			style:background-color="#dc2626"
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
			<circle class="opacity-25" cx="12" cy="12" r="9" stroke="white" stroke-width="3"></circle>
			<path class="opacity-90" fill="white" d="M12 3a9 9 0 0 1 9 9h-3a6 6 0 0 0-6-6V3z" />
		{:else if status === 'recording'}
			<rect x="7" y="7" width="10" height="10" rx="2" fill="white" />
		{:else}
			<path
				fill="white"
				d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 0 0-7 0v5A3.5 3.5 0 0 0 12 15Z"
			/>
			<path
				stroke="white"
				stroke-width="1.8"
				stroke-linecap="round"
				fill="none"
				d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3"
			/>
		{/if}
	</svg>
</button>
