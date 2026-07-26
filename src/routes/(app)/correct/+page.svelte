<script lang="ts">
	import { LANGUAGES } from '$lib/languages';
	import CorrectionsList from '$lib/components/CorrectionsList.svelte';
	import SentenceAnalysis from '$lib/components/SentenceAnalysis.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let targetLanguage = $state(data.user.targetLanguage ?? LANGUAGES[0].code);
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
				return;
			}
			result = await response.json();
		} catch {
			result = 'error';
		}
	}
</script>

<div class="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
	<h1 class="text-lg font-semibold">Corregir</h1>

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

	<textarea
		bind:value={text}
		rows="8"
		placeholder="Escribe aquí tu texto para que lo revise..."
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
		<SentenceAnalysis analysis={result.styleAnalysis} />
		<CorrectionsList corrections={result.corrections} overallFeedback={result.overallFeedback} />
	{/if}
</div>
