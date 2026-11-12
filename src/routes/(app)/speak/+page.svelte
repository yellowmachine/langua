<script lang="ts">
	import { untrack } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { announcer } from '$lib/announcer.svelte';
	import { LANGUAGES } from '$lib/languages';
	import RecordButton from '$lib/components/RecordButton.svelte';
	import CorrectionsList from '$lib/components/CorrectionsList.svelte';
	import SpeakButton from '$lib/components/SpeakButton.svelte';
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { LEVELS } from '$lib/levels';
	import type { SpeechComparison } from '$lib/speechCompare';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// The account's languages are only the starting choice: the selects own it.
	let targetLanguage = $state(untrack(() => data.user.targetLanguage ?? LANGUAGES[0].code));
	let text = $state('');

	// «Repetir una frase» (say a given sentence, scored) or «Hablar libre».
	let mode: 'sentence' | 'free' = $state('sentence');

	let level = $state('beginner');
	let topic = $state('');
	let target = $state<{ sentence: string; translation: string; targetLanguage: string } | null>(
		null
	);
	let generating = $state(false);
	let scoring = $state(false);
	let attempt = $state<(SpeechComparison & { transcript: string }) | null>(null);
	let failure = $state('');

	async function postAction(name: string, fields: Record<string, string>): Promise<unknown> {
		const body = new FormData();
		for (const [key, value] of Object.entries(fields)) body.set(key, value);
		const response = await fetch(`?/${name}`, { method: 'POST', body });
		const result = deserialize(await response.text());
		if (result.type !== 'success' || !result.data) throw new Error(result.type);
		return result.data;
	}

	async function newSentence() {
		generating = true;
		failure = '';
		try {
			target = (await postAction('sentence', { targetLanguage, level, topic })) as NonNullable<
				typeof target
			>;
			attempt = null;
			announcer.say(`Frase nueva: ${target.sentence}. ${target.translation}`);
		} catch {
			failure = 'No se pudo crear la frase. Inténtalo otra vez.';
			announcer.alert(failure);
		} finally {
			generating = false;
		}
	}

	async function scoreAttempt(transcript: string) {
		if (!target) return;
		scoring = true;
		failure = '';
		try {
			attempt = (await postAction('attempt', {
				targetLanguage: target.targetLanguage,
				sentence: target.sentence,
				transcript
			})) as NonNullable<typeof attempt>;
			const missing = attempt.words.filter((word) => !word.said).length;
			announcer.say(
				`Puntuación: ${attempt.score} de 100.` +
					(missing > 0
						? ` Te ${missing === 1 ? 'ha faltado 1 palabra' : `han faltado ${missing} palabras`}.`
						: '')
			);
			invalidateAll();
		} catch {
			failure = 'No se pudo puntuar la grabación. Inténtalo otra vez.';
			announcer.alert(failure);
		} finally {
			scoring = false;
		}
	}

	function scoreLabel(score: number) {
		if (score >= 90) return '¡Muy bien!';
		if (score >= 60) return 'Casi';
		return 'Vuelve a intentarlo';
	}

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

	<div role="group" aria-label="Modo" class="flex gap-2">
		<Button variant="secondary" pressed={mode === 'sentence'} onclick={() => (mode = 'sentence')}>
			Repetir una frase
		</Button>
		<Button variant="secondary" pressed={mode === 'free'} onclick={() => (mode = 'free')}>
			Hablar libre
		</Button>
	</div>

	{#if mode === 'sentence'}
		{@render sentenceMode()}
	{:else}
		{@render freeMode()}
	{/if}

	{#if data.recentAttempts.length > 0}
		<section class="flex flex-col gap-2">
			<h2 class="text-sm font-medium text-ink-muted">Últimas frases</h2>
			<ul class="flex flex-col gap-1 text-sm">
				{#each data.recentAttempts as recent (recent.id)}
					<li class="flex items-baseline justify-between gap-3">
						<span class="truncate" lang={recent.targetLanguage}>{recent.targetText}</span>
						<span class="shrink-0 font-medium">{recent.score}/100</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

{#snippet sentenceMode()}
	<div class="flex flex-wrap items-end gap-3">
		<label class="flex flex-col gap-1 text-sm">
			Idioma
			<select
				bind:value={targetLanguage}
				class="rounded-md border border-border bg-surface py-2 pr-9 pl-3"
			>
				{#each LANGUAGES as lang (lang.code)}
					<option value={lang.code}>{lang.label}</option>
				{/each}
			</select>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			Nivel
			<select bind:value={level} class="rounded-md border border-border bg-surface py-2 pr-9 pl-3">
				{#each LEVELS as lvl (lvl.code)}
					<option value={lvl.code}>{lvl.label}</option>
				{/each}
			</select>
		</label>
		<label class="flex min-w-40 flex-1 flex-col gap-1 text-sm">
			Tema (opcional)
			<input
				bind:value={topic}
				maxlength={200}
				placeholder="En el médico, de compras…"
				class="rounded-md border border-border bg-background px-3 py-2"
			/>
		</label>
		<Button onclick={newSentence} disabled={generating}>
			{generating ? 'Creando...' : target ? 'Otra frase' : 'Nueva frase'}
		</Button>
	</div>

	{#if target}
		<section
			aria-label="Frase para repetir"
			class="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
		>
			<div class="flex items-start gap-2">
				<p class="flex-1 text-lg font-medium" lang={target.targetLanguage}>{target.sentence}</p>
				<SpeakButton text={target.sentence} language={target.targetLanguage} />
			</div>
			<p class="text-sm text-ink-muted">{target.translation}</p>
		</section>

		<div class="flex items-center gap-3">
			<RecordButton
				onTranscript={scoreAttempt}
				language={target.targetLanguage}
				disabled={scoring}
			/>
			<span class="text-sm text-ink-muted">
				{scoring ? 'Puntuando...' : 'Pulsa, lee la frase en voz alta y vuelve a pulsar'}
			</span>
		</div>

		{#if attempt}
			<section
				aria-label="Resultado"
				class="flex flex-col gap-2 rounded-lg border border-border p-4"
			>
				<p>
					<strong class="text-2xl">{attempt.score}</strong>/100 · {scoreLabel(attempt.score)}
				</p>
				<p class="flex flex-wrap gap-x-1.5 text-lg" lang={target.targetLanguage}>
					{#each attempt.words as word, i (i)}
						{#if word.said}
							<span>{word.text}</span>
						{:else}
							<span class="text-danger line-through decoration-2"
								>{word.text}<span class="sr-only" lang="es"> (no dicha)</span></span
							>
						{/if}
					{/each}
				</p>
				{#if attempt.words.some((word) => !word.said)}
					<p class="text-xs text-ink-muted">Tachadas: las palabras que no se han oído.</p>
				{/if}
				{#if attempt.extra.length > 0}
					<p class="text-sm">
						Has añadido: <span lang={target.targetLanguage}>{attempt.extra.join(', ')}</span>
					</p>
				{/if}
				<p class="text-sm text-ink-muted">
					Se ha oído: «<span lang={target.targetLanguage}>{attempt.transcript || '…'}</span>»
				</p>
			</section>
		{/if}
	{:else}
		<p class="text-sm text-ink-muted">
			Pide una frase, escúchala si quieres y repítela en voz alta: te diremos qué palabras se han
			oído.
		</p>
	{/if}

	{#if failure}
		<p class="text-sm text-danger" role="alert">{failure}</p>
	{/if}
{/snippet}

{#snippet freeMode()}
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
{/snippet}
