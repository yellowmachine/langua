<script lang="ts">
	import { untrack } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { announcer } from '$lib/announcer.svelte';
	import { LANGUAGES } from '$lib/languages';
	import CorrectionsList from '$lib/components/CorrectionsList.svelte';
	import SentenceAnalysis from '$lib/components/SentenceAnalysis.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// The account's languages are only the starting choice: the selects own it.
	let targetLanguage = $state(untrack(() => data.user.targetLanguage ?? LANGUAGES[0].code));
	let text = $state('');

	type Correction = { original: string; correction: string; explanation: string };
	type StyleAnalysis = {
		register: 'very_informal' | 'informal' | 'neutral' | 'formal' | 'very_formal';
		registerNotes: string;
		naturalness:
			'native_sounding' | 'mostly_natural' | 'somewhat_stilted' | 'clearly_translated_sounding';
		naturalnessNotes: string;
		cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
		cefrNotes: string;
	};
	type Result =
		| 'idle'
		| 'loading'
		| {
				corrections: Correction[];
				overallFeedback: string | null;
				styleAnalysis: StyleAnalysis;
		  }
		| 'error';
	let result: Result = $state('idle');

	async function check() {
		const trimmed = text.trim();
		if (!trimmed) return;

		result = 'loading';
		try {
			const response = await fetch('/correct/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: trimmed, targetLanguage, includeStyleAnalysis: true })
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

<svelte:head><title>Corregir · Langua</title></svelte:head>

<div class="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
	<h1 class="text-lg font-semibold">Corregir</h1>

	<label class="flex flex-col gap-1 text-sm">
		Idioma
		<select
			bind:value={targetLanguage}
			class="rounded-md border py-2 pr-9 pl-3"
			style:border-color="var(--color-border)"
			style:background-color="var(--color-surface)"
		>
			{#each LANGUAGES as lang (lang.code)}
				<option value={lang.code}>{lang.label}</option>
			{/each}
		</select>
	</label>

	<textarea
		bind:value={text}
		lang={targetLanguage}
		aria-label="Texto que quieres corregir"
		rows="8"
		placeholder="Escribe aquí tu texto para que lo revise..."
		class="rounded-md border px-3 py-2 text-sm"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-background)"></textarea>

	<Button class="w-fit" onclick={check} disabled={result === 'loading' || !text.trim()}>
		{result === 'loading' ? 'Revisando...' : 'Corregir'}
	</Button>

	{#if result === 'error'}
		<p class="text-sm" style:color="var(--color-danger)">No se pudo revisar el texto.</p>
	{:else if result !== 'idle' && result !== 'loading'}
		<SentenceAnalysis analysis={result.styleAnalysis} />
		<CorrectionsList
			corrections={result.corrections}
			overallFeedback={result.overallFeedback}
			language={targetLanguage}
		/>
	{/if}
</div>
