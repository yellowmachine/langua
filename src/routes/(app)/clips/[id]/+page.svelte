<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import SpeakButton from '$lib/components/SpeakButton.svelte';
	import { clipOrigin, formatTimestamp } from '$lib/clips';
	import { LANGUAGES } from '$lib/languages';
	import { splitIntoWords } from '$lib/wordTokens';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const dateFormatter = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

	let audio: HTMLAudioElement | undefined = $state();
	let currentTime = $state(0);
	let confirmingDelete = $state(false);

	const WORD_POS_LABELS: Record<string, string> = {
		noun: 'Sustantivo',
		verb: 'Verbo',
		adjective: 'Adjetivo',
		adverb: 'Adverbio',
		other: 'Otro'
	};

	// The phrase the learner clicked: its words become clickable and it can
	// be translated. Separate from activeIndex, which follows the audio.
	let selectedIndex: number | null = $state(null);
	let translations: Record<number, string | 'loading' | 'error'> = $state({});

	type WordLookup =
		| 'idle'
		| 'loading'
		| 'error'
		| {
				cueIndex: number;
				word: string;
				lemma: string;
				partOfSpeech: string;
				translation: string;
				explanation: string;
				saved: boolean;
		  };
	let wordLookup: WordLookup = $state('idle');

	let languageLabel = $derived(
		LANGUAGES.find((lang) => lang.code === data.clip.language)?.label ?? 'Idioma desconocido'
	);
	let transcribing = $derived(
		data.clip.transcriptionStatus === 'pending' && data.transcriptionQueued
	);
	// 'pending' but no longer queued: the server restarted mid-transcription.
	let canRetry = $derived(
		data.clip.transcriptionStatus === 'failed' ||
			(data.clip.transcriptionStatus === 'pending' && !data.transcriptionQueued)
	);
	let activeIndex = $derived(
		data.clip.cues.findIndex((cue) => cue.start <= currentTime && currentTime < cue.end)
	);

	// Check back until the background transcription is done.
	$effect(() => {
		if (!transcribing) return;
		const interval = setInterval(() => invalidateAll(), 5000);
		return () => clearInterval(interval);
	});

	// Keeps the phrase being played in view as the audio advances.
	function scrollIntoViewWhen(active: boolean) {
		return (element: HTMLElement) => {
			if (active) element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		};
	}

	function playFrom(seconds: number) {
		if (!audio) return;
		audio.currentTime = seconds;
		void audio.play();
	}

	function selectCue(index: number) {
		if (selectedIndex !== index) wordLookup = 'idle';
		selectedIndex = index;
		playFrom(data.clip.cues[index].start);
	}

	async function translateCue(cueIndex: number) {
		if (translations[cueIndex] && translations[cueIndex] !== 'error') return;
		translations[cueIndex] = 'loading';
		try {
			const response = await fetch(resolve('/(app)/clips/[id]/translate', { id: data.clip.id }), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cueIndex })
			});
			if (!response.ok) throw new Error();
			const result: { translation: string } = await response.json();
			translations[cueIndex] = result.translation;
		} catch {
			translations[cueIndex] = 'error';
		}
	}

	async function lookupWord(cueIndex: number, word: string) {
		wordLookup = 'loading';
		try {
			const response = await fetch(resolve('/(app)/clips/[id]/word', { id: data.clip.id }), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cueIndex, word })
			});
			if (!response.ok) throw new Error();
			const result: {
				lemma: string;
				partOfSpeech: string;
				translation: string;
				explanation: string;
			} = await response.json();
			wordLookup = { cueIndex, word, ...result, saved: false };
		} catch {
			wordLookup = 'error';
		}
	}

	async function saveWord() {
		if (wordLookup === 'idle' || wordLookup === 'loading' || wordLookup === 'error') return;
		if (wordLookup.saved) return;
		const current = wordLookup;

		try {
			const response = await fetch(resolve('/(app)/clips/[id]/word', { id: data.clip.id }), {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cueIndex: current.cueIndex,
					word: current.word,
					lemma: current.lemma,
					partOfSpeech: current.partOfSpeech,
					translation: current.translation
				})
			});
			// Only mark saved if the panel is still showing this same lookup.
			if (response.ok && wordLookup === current) wordLookup.saved = true;
		} catch {
			// leave it as-is so the learner can retry
		}
	}
</script>

<div class="mx-auto flex max-w-2xl flex-col gap-6 p-6">
	<header class="flex flex-col gap-1">
		<a href={resolve('/clips')} class="text-sm" style:color="var(--color-ink-muted)">← Clips</a>
		<h1 class="text-xl font-semibold">{clipOrigin(data.clip)}</h1>
		{#if data.clip.kind === 'episode' && data.clip.series}
			<p>{data.clip.title}</p>
		{/if}
		<p class="text-xs" style:color="var(--color-ink-muted)">
			{dateFormatter.format(data.clip.capturedAt)} · {languageLabel}
		</p>
	</header>

	<audio
		bind:this={audio}
		bind:currentTime
		controls
		preload="metadata"
		src={resolve('/(app)/clips/[id]/audio', { id: data.clip.id })}
		class="w-full"
	></audio>

	<section
		class="flex flex-col gap-1 rounded-lg border p-2"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-surface)"
	>
		{#if transcribing}
			<p class="p-2 text-sm" style:color="var(--color-ink-muted)">
				Transcribiendo… Puede tardar unos minutos; el texto aparecerá aquí solo.
			</p>
		{:else if canRetry}
			<form
				method="POST"
				action="?/retranscribe"
				use:enhance
				class="flex flex-wrap items-center gap-3 p-2"
			>
				<p class="text-sm text-red-600">
					{data.clip.transcriptionStatus === 'failed'
						? 'No se pudo transcribir este clip.'
						: 'La transcripción se interrumpió.'}
				</p>
				<button
					type="submit"
					class="rounded-md border px-3 py-1.5 text-sm"
					style:border-color="var(--color-border)"
				>
					Reintentar
				</button>
			</form>
		{:else if data.clip.cues.length === 0}
			<p class="p-2 text-sm" style:color="var(--color-ink-muted)">
				No se ha encontrado texto en este clip.
			</p>
		{:else}
			{#each data.clip.cues as cue, i (i)}
				<div
					{@attach scrollIntoViewWhen(i === activeIndex)}
					class="rounded-md"
					style:background-color={i === activeIndex || i === selectedIndex
						? 'var(--color-background)'
						: 'transparent'}
				>
					{#if i === selectedIndex}
						{@render selectedCue(cue.start, cue.text, i)}
					{:else}
						<button
							type="button"
							onclick={() => selectCue(i)}
							class="flex w-full gap-3 px-2 py-1.5 text-left"
							style:font-weight={i === activeIndex ? '600' : '400'}
						>
							<span
								class="shrink-0 font-mono text-xs leading-6"
								style:color="var(--color-ink-muted)"
							>
								{formatTimestamp(cue.start)}
							</span>
							<span class="whitespace-pre-line">{cue.text}</span>
						</button>
					{/if}
				</div>
			{/each}
		{/if}
	</section>

	<form method="POST" action="?/delete" use:enhance class="flex items-center gap-3">
		{#if confirmingDelete}
			<span class="text-sm">¿Borrar este clip y su audio?</span>
			<button
				type="submit"
				class="rounded-md px-3 py-1.5 text-sm font-medium text-white"
				style:background-color="#dc2626"
			>
				Borrar
			</button>
			<button
				type="button"
				onclick={() => (confirmingDelete = false)}
				class="rounded-md border px-3 py-1.5 text-sm"
				style:border-color="var(--color-border)"
			>
				Cancelar
			</button>
		{:else}
			<button
				type="button"
				onclick={() => (confirmingDelete = true)}
				class="rounded-md border px-3 py-1.5 text-sm text-red-600"
				style:border-color="var(--color-border)"
			>
				Borrar clip
			</button>
		{/if}
	</form>
</div>

{#snippet selectedCue(start: number, text: string, cueIndex: number)}
	{@const translation = translations[cueIndex]}
	<div class="flex gap-3 px-2 py-1.5" style:font-weight={cueIndex === activeIndex ? '600' : '400'}>
		<button
			type="button"
			onclick={() => playFrom(start)}
			aria-label="Reproducir desde aquí"
			class="shrink-0 font-mono text-xs leading-6 underline"
			style:color="var(--color-ink-muted)"
		>
			{formatTimestamp(start)}
		</button>
		<span class="whitespace-pre-line">
			{#if data.clip.language}
				{#each splitIntoWords(text) as token, t (t)}
					{#if token.clickable}
						<button
							type="button"
							onclick={() => lookupWord(cueIndex, token.text)}
							class="hover:underline"
							style:font="inherit"
							style:color="inherit">{token.text}</button
						>
					{:else}
						{token.text}
					{/if}
				{/each}
			{:else}
				{text}
			{/if}
		</span>
	</div>

	<div class="flex flex-col gap-2 px-2 pb-2 pl-14 text-sm">
		{#if !data.clip.language}
			<p class="text-xs" style:color="var(--color-ink-muted)">
				Langua no conoce el idioma de este clip, así que no puede traducirlo ni analizarlo.
			</p>
		{:else}
			{#if translation === undefined || translation === 'error'}
				<button
					type="button"
					onclick={() => translateCue(cueIndex)}
					class="w-fit text-xs underline"
					style:color="var(--color-ink-muted)"
				>
					Traducir
				</button>
				{#if translation === 'error'}
					<p class="text-xs" style:color="#f87171">No se pudo traducir la frase.</p>
				{/if}
			{:else if translation === 'loading'}
				<p class="text-xs italic" style:color="var(--color-ink-muted)">Traduciendo...</p>
			{:else}
				<p class="text-xs italic" style:color="var(--color-ink-muted)">{translation}</p>
			{/if}

			{#if wordLookup === 'idle'}
				<p class="text-xs" style:color="var(--color-ink-muted)">
					Toca una palabra para ver su información.
				</p>
			{:else if wordLookup === 'loading'}
				<p class="text-xs italic" style:color="var(--color-ink-muted)">Analizando...</p>
			{:else if wordLookup === 'error'}
				<p class="text-xs" style:color="#f87171">No se pudo analizar la palabra.</p>
			{:else}
				<div
					class="flex flex-col gap-2 rounded-md border p-3"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-surface)"
				>
					<div class="flex items-center gap-2">
						<span class="font-medium">{wordLookup.word}</span>
						<SpeakButton text={wordLookup.word} language={data.clip.language} />
					</div>
					<span class="text-xs" style:color="var(--color-ink-muted)">
						{WORD_POS_LABELS[wordLookup.partOfSpeech] ?? wordLookup.partOfSpeech}
					</span>
					<p>{wordLookup.translation}</p>
					<p class="text-xs" style:color="var(--color-ink-muted)">{wordLookup.explanation}</p>
					<button
						type="button"
						onclick={saveWord}
						disabled={wordLookup.saved}
						class="w-fit rounded-md px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
						style:background-color="var(--color-accent)"
					>
						{wordLookup.saved ? 'Añadida al libro de estudio' : 'Añadir al libro de estudio'}
					</button>
				</div>
			{/if}
		{/if}
	</div>
{/snippet}
