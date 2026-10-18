<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import Repeat from '@lucide/svelte/icons/repeat';
	import SkipBack from '@lucide/svelte/icons/skip-back';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import SpeakButton from '$lib/components/SpeakButton.svelte';
	import { activeCueIndex, clipOrigin, cueSpan, formatTimestamp } from '$lib/clips';
	import { LANGUAGES } from '$lib/languages';
	import { splitIntoWords } from '$lib/wordTokens';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const dateFormatter = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

	let audio: HTMLAudioElement | undefined = $state();
	let currentTime = $state(0);
	let playbackRate = $state(1);
	let duration = $state(0);
	let paused = $state(true);
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

	const PLAYBACK_RATES = [0.5, 0.75, 1];

	// "Repetir frase": the phrase being looped, or null.
	let loopIndex: number | null = $state(null);

	// Whether `time` is far enough outside the looped phrase to be a seek
	// elsewhere (as opposed to just running past its end).
	function isAwayFromLoop(index: number, time: number) {
		const { start, end } = cueSpan(data.clip.cues, index);
		return time < start - 0.5 || time > end + 0.5;
	}

	// "Escuchar primero": phrases stay blurred until revealed one by one, so
	// the learner listens before reading.
	let listenFirst = $state(false);
	const revealed = new SvelteSet<number>();

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
	// Subtitles that came in another language than the audio, shown under
	// whichever transcribed phrases they overlap in time. Whisper can give a
	// phrase (almost) no duration, hence the minimum width.
	let subtitlesByCue = $derived(
		data.clip.cues.map((cue) =>
			data.clip.translationCues
				.filter((sub) => sub.start < Math.max(cue.end, cue.start + 0.5) && sub.end > cue.start)
				.map((sub) => sub.text)
				.join(' ')
		)
	);
	let subtitlesLanguage = $derived(
		LANGUAGES.find((lang) => lang.code === data.clip.translationLanguage)?.label.toLowerCase()
	);
	let activeIndex = $derived(activeCueIndex(data.clip.cues, currentTime));

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

	function togglePlay() {
		if (!audio) return;
		if (audio.paused) void audio.play();
		else audio.pause();
	}

	// Previous/next phrase, like a music player's previous/next track:
	// "previous" first goes back to the start of the current phrase if it's
	// been playing for a bit.
	function jumpPhrase(direction: -1 | 1) {
		const cues = data.clip.cues;
		if (cues.length === 0) return;

		let current = -1;
		for (let i = 0; i < cues.length && cues[i].start <= currentTime; i++) current = i;

		let target: number;
		if (direction === 1) target = current + 1;
		else if (current >= 0 && currentTime - cues[current].start > 1) target = current;
		else target = current - 1;
		target = Math.min(Math.max(target, 0), cues.length - 1);

		if (loopIndex !== null) loopIndex = target;
		playFrom(cues[target].start);
	}

	function selectCue(index: number) {
		if (selectedIndex !== index) wordLookup = 'idle';
		selectedIndex = index;
		if (loopIndex !== null) loopIndex = index;
		playFrom(data.clip.cues[index].start);
	}

	// While hidden, clicking a phrase only plays it: selecting it would show
	// its words.
	function playHidden(index: number) {
		if (loopIndex !== null) loopIndex = index;
		playFrom(data.clip.cues[index].start);
	}

	function toggleLoop() {
		if (loopIndex !== null) {
			loopIndex = null;
			return;
		}
		const index = selectedIndex ?? (activeIndex >= 0 ? activeIndex : null);
		if (index === null) return;
		loopIndex = index;
		playFrom(cueSpan(data.clip.cues, index).start);
	}

	function toggleListenFirst() {
		listenFirst = !listenFirst;
		revealed.clear();
		selectedIndex = null;
		wordLookup = 'idle';
	}

	// A timer set for the exact end of the phrase, rescheduled whenever
	// playback starts, seeks or changes speed. Not timeupdate alone (~4 times
	// a second, letting the start of the next phrase slip through) nor
	// requestAnimationFrame (throttled to a couple of frames a second when
	// the window is covered or saving power).
	$effect(() => {
		if (loopIndex === null || !audio) return;
		const player = audio;
		const index = loopIndex;
		// The same stretch the highlight covers, not just the phrase's
		// recorded timings, which often end before the speech does.
		const { start, end } = cueSpan(data.clip.cues, index);

		let timer: ReturnType<typeof setTimeout> | undefined;
		const schedule = () => {
			clearTimeout(timer);
			// Seeked elsewhere: stopLoopIfSeekedAway ends the loop, don't pull back.
			if (player.paused || isAwayFromLoop(index, player.currentTime)) return;
			if (player.currentTime >= end) {
				player.currentTime = start; // its 'seeked' reschedules
				return;
			}
			timer = setTimeout(schedule, ((end - player.currentTime) / player.playbackRate) * 1000);
		};

		const events = ['play', 'seeked', 'ratechange', 'timeupdate'] as const;
		for (const event of events) player.addEventListener(event, schedule);
		schedule();
		return () => {
			clearTimeout(timer);
			for (const event of events) player.removeEventListener(event, schedule);
		};
	});

	// Seeking elsewhere with the player's own controls ends the loop. Our own
	// jumps back to the start of the looped phrase land inside it.
	function stopLoopIfSeekedAway() {
		if (loopIndex !== null && audio && isAwayFromLoop(loopIndex, audio.currentTime)) {
			loopIndex = null;
		}
	}

	let vocabExtraction: 'idle' | 'loading' | { added: number } | 'error' = $state('idle');

	async function extractVocabulary() {
		if (vocabExtraction === 'loading') return;

		vocabExtraction = 'loading';
		try {
			const response = await fetch(resolve('/(app)/clips/[id]/vocabulary', { id: data.clip.id }), {
				method: 'POST'
			});
			if (!response.ok) {
				vocabExtraction = 'error';
				return;
			}
			const result: { added: number } = await response.json();
			vocabExtraction = { added: result.added };
		} catch {
			vocabExtraction = 'error';
		}
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

	<!-- Native controls can't be restyled, so the <audio> stays hidden and
	     the bar below drives it. -->
	<audio
		bind:this={audio}
		bind:currentTime
		bind:duration
		bind:paused
		bind:playbackRate
		onseeked={stopLoopIfSeekedAway}
		preload="metadata"
		src={resolve('/(app)/clips/[id]/audio', { id: data.clip.id })}
	></audio>
	{@render player()}

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
			{@render practiceControls()}
			{#if data.clip.translationCues.length > 0 && !listenFirst}
				<p class="px-2 pt-1 text-xs" style:color="var(--color-ink-muted)">
					En cursiva, los subtítulos {subtitlesLanguage
						? `en ${subtitlesLanguage}`
						: 'en otro idioma'} que venían con el vídeo.
				</p>
			{/if}
			{#each data.clip.cues as cue, i (i)}
				<div
					{@attach scrollIntoViewWhen(i === activeIndex)}
					class="rounded-md transition-colors"
					style:background-color={i === activeIndex
						? 'color-mix(in srgb, var(--color-accent) 18%, transparent)'
						: i === selectedIndex
							? 'var(--color-background)'
							: 'transparent'}
					style:box-shadow={i === activeIndex ? 'inset 3px 0 0 var(--color-accent)' : 'none'}
					style:color={i === activeIndex ? 'var(--color-accent)' : undefined}
				>
					{#if listenFirst && !revealed.has(i)}
						{@render hiddenCue(cue.start, cue.text, i)}
					{:else if i === selectedIndex}
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
							<span class="flex flex-col">
								<span class="whitespace-pre-line">{cue.text}</span>
								{@render subtitles(i)}
							</span>
						</button>
					{/if}
				</div>
			{/each}
		{/if}
	</section>

	{#if data.clip.language && data.clip.cues.length > 0 && !transcribing && !canRetry}
		<div class="flex flex-wrap items-center gap-2 text-sm">
			<button
				type="button"
				onclick={extractVocabulary}
				disabled={vocabExtraction === 'loading'}
				class="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60"
				style:border-color="var(--color-border)"
			>
				Extraer vocabulario
			</button>
			{#if vocabExtraction === 'loading'}
				<span class="text-xs italic" style:color="var(--color-ink-muted)">Extrayendo...</span>
			{:else if vocabExtraction === 'error'}
				<span class="text-xs" style:color="#f87171">No se pudo extraer el vocabulario.</span>
			{:else if vocabExtraction !== 'idle'}
				<span class="text-xs" style:color="var(--color-ink-muted)">
					{vocabExtraction.added > 0
						? `${vocabExtraction.added} palabra${vocabExtraction.added === 1 ? '' : 's'} nueva${vocabExtraction.added === 1 ? '' : 's'}`
						: 'Sin palabras nuevas'} —
					<a href={resolve('/study')} class="underline" style:color="var(--color-accent)"
						>ver libro de estudio</a
					>
				</span>
			{/if}
		</div>
	{/if}

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
		{@render subtitles(cueIndex)}
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

{#snippet subtitles(cueIndex: number)}
	{#if subtitlesByCue[cueIndex]}
		<span class="text-xs font-normal italic" style:color="var(--color-ink-muted)">
			{subtitlesByCue[cueIndex]}
		</span>
	{/if}
{/snippet}

{#snippet practiceControls()}
	<div
		class="flex flex-wrap items-center gap-2 border-b px-2 pb-2 text-xs"
		style:border-color="var(--color-border)"
	>
		<div class="flex items-center gap-1" role="group" aria-label="Velocidad">
			{#each PLAYBACK_RATES as rate (rate)}
				<button
					type="button"
					onclick={() => (playbackRate = rate)}
					aria-pressed={playbackRate === rate}
					class="rounded-md border px-2 py-1"
					style:border-color={playbackRate === rate ? 'var(--color-accent)' : 'var(--color-border)'}
					style:color={playbackRate === rate ? 'var(--color-accent)' : undefined}
				>
					{rate.toLocaleString('es')}×
				</button>
			{/each}
		</div>
		<button
			type="button"
			onclick={toggleLoop}
			aria-pressed={loopIndex !== null}
			disabled={loopIndex === null && selectedIndex === null && activeIndex < 0}
			class="flex items-center gap-1.5 rounded-md border px-2 py-1 disabled:opacity-50"
			style:border-color={loopIndex !== null ? 'var(--color-accent)' : 'var(--color-border)'}
			style:color={loopIndex !== null ? 'var(--color-accent)' : undefined}
		>
			<Repeat class="h-3.5 w-3.5" />
			Repetir frase
		</button>
		<button
			type="button"
			onclick={toggleListenFirst}
			aria-pressed={listenFirst}
			class="flex items-center gap-1.5 rounded-md border px-2 py-1"
			style:border-color={listenFirst ? 'var(--color-accent)' : 'var(--color-border)'}
			style:color={listenFirst ? 'var(--color-accent)' : undefined}
		>
			<EyeOff class="h-3.5 w-3.5" />
			Escuchar primero
		</button>
	</div>
{/snippet}

{#snippet hiddenCue(start: number, text: string, cueIndex: number)}
	<div class="flex items-start gap-3 px-2 py-1.5">
		<button
			type="button"
			onclick={() => playHidden(cueIndex)}
			class="flex min-w-0 flex-1 gap-3 text-left"
		>
			<span class="shrink-0 font-mono text-xs leading-6" style:color="var(--color-ink-muted)">
				{formatTimestamp(start)}
			</span>
			<span class="sr-only">Frase oculta</span>
			<span aria-hidden="true" class="blur-sm select-none">{text}</span>
		</button>
		<button
			type="button"
			onclick={() => revealed.add(cueIndex)}
			class="shrink-0 text-xs leading-6 underline"
			style:color="var(--color-ink-muted)"
		>
			Mostrar
		</button>
	</div>
{/snippet}

{#snippet player()}
	{@const total = Number.isFinite(duration) ? duration : 0}
	<div
		class="flex items-center gap-2 rounded-lg border px-3 py-2"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-surface)"
	>
		<button
			type="button"
			onclick={() => jumpPhrase(-1)}
			disabled={data.clip.cues.length === 0}
			aria-label="Frase anterior"
			class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md disabled:opacity-40"
		>
			<SkipBack class="h-4 w-4" />
		</button>
		<button
			type="button"
			onclick={togglePlay}
			aria-label={paused ? 'Reproducir' : 'Pausar'}
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
			style:background-color="var(--color-accent)"
		>
			{#if paused}
				<Play class="ml-0.5 h-5 w-5" fill="currentColor" />
			{:else}
				<Pause class="h-5 w-5" fill="currentColor" />
			{/if}
		</button>
		<button
			type="button"
			onclick={() => jumpPhrase(1)}
			disabled={data.clip.cues.length === 0}
			aria-label="Frase siguiente"
			class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md disabled:opacity-40"
		>
			<SkipForward class="h-4 w-4" />
		</button>

		<span class="w-10 shrink-0 text-right font-mono text-xs" style:color="var(--color-ink-muted)">
			{formatTimestamp(currentTime)}
		</span>
		<input
			type="range"
			min="0"
			max={total}
			step="0.01"
			value={currentTime}
			oninput={(event) => {
				if (audio) audio.currentTime = Number(event.currentTarget.value);
			}}
			aria-label="Posición"
			aria-valuetext={`${formatTimestamp(currentTime)} de ${formatTimestamp(total)}`}
			class="min-w-0 flex-1 cursor-pointer"
			style:accent-color="var(--color-accent)"
		/>
		<span class="w-10 shrink-0 font-mono text-xs" style:color="var(--color-ink-muted)">
			{formatTimestamp(total)}
		</span>
	</div>
{/snippet}
