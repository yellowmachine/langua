<script lang="ts">
	import { LANGUAGES } from '$lib/languages';
	import RecordButton from '$lib/components/RecordButton.svelte';
	import CorrectionsList from '$lib/components/CorrectionsList.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let targetLanguage = $state(data.user.targetLanguage ?? LANGUAGES[0].code);
	let text = $state('');

	type Correction = { original: string; correction: string; explanation: string };
	type Result =
		'idle' | 'loading' | { corrections: Correction[]; overallFeedback: string | null } | 'error';
	let result: Result = $state('idle');

	function appendTranscript(transcript: string) {
		text = text.trim() ? `${text.trim()} ${transcript}` : transcript;
	}

	async function check() {
		const trimmed = text.trim();
		if (!trimmed) return;

		result = 'loading';
		try {
			const response = await fetch('/correct/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: trimmed, targetLanguage })
			});
			if (!response.ok) {
				result = 'error';
				return;
			}
			result = await response.json();
		} catch {
			result = 'error';
		}
	}
</script>

<div class="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
	<h1 class="text-lg font-semibold">Hablar</h1>

	<label class="flex flex-col gap-1 text-sm">
		Idioma
		<select
			bind:value={targetLanguage}
			class="rounded-md border px-3 py-2"
			style:border-color="var(--color-border)"
			style:background-color="var(--color-surface)"
		>
			{#each LANGUAGES as lang (lang.code)}
				<option value={lang.code}>{lang.label}</option>
			{/each}
		</select>
	</label>

	<div class="flex items-center gap-2">
		<RecordButton onTranscript={appendTranscript} language={targetLanguage} />
		<span class="text-sm" style:color="var(--color-ink-muted)">Graba lo que quieras decir</span>
	</div>

	<textarea
		bind:value={text}
		rows="8"
		placeholder="El texto transcrito aparecerá aquí — puedes editarlo antes de corregir..."
		class="rounded-md border px-3 py-2 text-sm"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-background)"></textarea>

	<button
		type="button"
		onclick={check}
		disabled={result === 'loading' || !text.trim()}
		class="w-fit rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
		style:background-color="var(--color-accent)"
	>
		{result === 'loading' ? 'Revisando...' : 'Corregir'}
	</button>

	{#if result === 'error'}
		<p class="text-sm" style:color="#f87171">No se pudo revisar el texto.</p>
	{:else if result !== 'idle' && result !== 'loading'}
		<CorrectionsList corrections={result.corrections} overallFeedback={result.overallFeedback} />
	{/if}
</div>
