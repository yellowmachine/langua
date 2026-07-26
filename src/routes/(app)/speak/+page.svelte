<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let currentPrompt = $state<string | null>(null);
	let generating = $state(false);
	let recording = $state(false);
	let submitting = $state(false);
	let micError = $state<string | null>(null);
	let lastResult = $state<{ transcript: string; score: number } | null>(null);

	let attemptForm: HTMLFormElement | undefined = $state();
	let audioInput: HTMLInputElement | undefined = $state();
	let mediaRecorder: MediaRecorder | null = null;
	let chunks: BlobPart[] = [];

	async function toggleRecording() {
		if (recording) {
			mediaRecorder?.stop();
			return;
		}

		micError = null;
		lastResult = null;

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			chunks = [];
			mediaRecorder = new MediaRecorder(stream);
			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) chunks.push(e.data);
			};
			mediaRecorder.onstop = () => {
				stream.getTracks().forEach((track) => track.stop());
				const file = new File([new Blob(chunks, { type: 'audio/webm' })], 'attempt.webm', {
					type: 'audio/webm'
				});
				const transfer = new DataTransfer();
				transfer.items.add(file);
				if (audioInput) audioInput.files = transfer.files;
				recording = false;
				submitting = true;
				attemptForm?.requestSubmit();
			};
			mediaRecorder.start();
			recording = true;
		} catch {
			micError = 'No se pudo acceder al micrófono. Revisa los permisos del navegador.';
		}
	}

	function scoreColor(score: number) {
		if (score >= 85) return 'var(--color-accent)';
		if (score >= 60) return 'var(--color-ink)';
		return '#dc2626';
	}
</script>

<div class="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
	<header class="flex items-center justify-between">
		<h1 class="text-xl font-semibold">Hablar</h1>
		<a href={resolve('/')} class="text-sm underline" style:color="var(--color-ink-muted)">
			Volver
		</a>
	</header>

	<section
		class="flex flex-col gap-4 rounded-lg border p-4"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-surface)"
	>
		<form
			method="POST"
			action="?/newPrompt"
			use:enhance={() => {
				generating = true;
				lastResult = null;
				return async ({ result }) => {
					generating = false;
					if (result.type === 'success' && result.data) {
						currentPrompt = result.data.prompt as string;
					}
				};
			}}
		>
			<button
				type="submit"
				disabled={generating || recording || submitting}
				class="rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
				style:background-color="var(--color-accent)"
			>
				{generating ? 'Generando...' : currentPrompt ? 'Otra frase' : 'Nueva frase'}
			</button>
		</form>

		{#if currentPrompt}
			<p class="text-lg">{currentPrompt}</p>

			<form
				bind:this={attemptForm}
				method="POST"
				action="?/attempt"
				enctype="multipart/form-data"
				use:enhance={() => {
					return async ({ result }) => {
						submitting = false;
						if (result.type === 'success' && result.data) {
							lastResult = result.data as { transcript: string; score: number };
						}
					};
				}}
			>
				<input type="hidden" name="prompt" value={currentPrompt} />
				<input bind:this={audioInput} type="file" name="audio" class="hidden" />

				<button
					type="button"
					onclick={toggleRecording}
					disabled={generating || submitting}
					class="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50"
					style:border-color="var(--color-border)"
					style:background-color={recording ? '#dc2626' : 'transparent'}
					style:color={recording ? 'white' : 'var(--color-ink)'}
				>
					{#if recording}
						Detener grabación
					{:else if submitting}
						Analizando...
					{:else}
						Grabar
					{/if}
				</button>
			</form>

			{#if micError}
				<p class="text-sm text-red-600">{micError}</p>
			{/if}

			{#if lastResult}
				<div class="rounded-md border p-3 text-sm" style:border-color="var(--color-border)">
					<p>Se ha entendido: <strong>{lastResult.transcript}</strong></p>
					<p class="mt-1">
						Puntuación: <strong style:color={scoreColor(lastResult.score)}
							>{lastResult.score}/100</strong
						>
					</p>
				</div>
			{/if}
		{:else}
			<p class="text-sm" style:color="var(--color-ink-muted)">
				Pulsa "Nueva frase" para empezar a practicar.
			</p>
		{/if}
	</section>

	{#if data.recentAttempts.length > 0}
		<section
			class="rounded-lg border p-4"
			style:border-color="var(--color-border)"
			style:background-color="var(--color-surface)"
		>
			<h2 class="mb-3 text-sm font-medium">Últimos intentos</h2>
			<ul class="flex flex-col gap-2 text-sm">
				{#each data.recentAttempts as attempt (attempt.id)}
					<li class="flex items-center justify-between gap-3">
						<span class="truncate">{attempt.prompt}</span>
						<span style:color={scoreColor(attempt.score)}>{attempt.score}/100</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
