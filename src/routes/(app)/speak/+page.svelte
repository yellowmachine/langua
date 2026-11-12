<script lang="ts">
	import { untrack } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { announcer } from '$lib/announcer.svelte';
	import { LANGUAGES } from '$lib/languages';
	import RecordButton from '$lib/components/RecordButton.svelte';
	import CorrectionsList from '$lib/components/CorrectionsList.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// The account's languages are only the starting choice: the selects own it.
	let targetLanguage = $state(untrack(() => data.user.targetLanguage ?? LANGUAGES[0].code));
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
				announcer.alert('No se pudo revisar el texto.');
				return;
			}
			const checked: Exclude<Result, 'idle' | 'loading' | 'error'> = await response.json();
			result = checked;
			announcer.say(
				checked.corrections.length === 0
					? 'Revisión lista: no hay errores.'
					: `Revisión lista: ${checked.corrections.length} correcciones.`
			);
		} catch {
			result = 'error';
			announcer.alert('No se pudo revisar el texto.');
		}
	}
</script>

<svelte:head><title>Hablar · Langua</title></svelte:head>

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
		lang={targetLanguage}
		aria-label="Texto que quieres corregir"
		rows="8"
		placeholder="El texto transcrito aparecerá aquí — puedes editarlo antes de corregir..."
		class="rounded-md border px-3 py-2 text-sm"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-background)"></textarea>

	<Button class="w-fit" onclick={check} disabled={result === 'loading' || !text.trim()}>
		{result === 'loading' ? 'Revisando...' : 'Corregir'}
	</Button>

	{#if result === 'error'}
		<p class="text-sm" style:color="var(--color-danger)">No se pudo revisar el texto.</p>
	{:else if result !== 'idle' && result !== 'loading'}
		<CorrectionsList
			corrections={result.corrections}
			overallFeedback={result.overallFeedback}
			language={targetLanguage}
		/>
	{/if}
</div>
