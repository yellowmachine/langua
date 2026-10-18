<script module lang="ts">
	export type WordLookupResult = {
		word: string;
		lemma: string;
		partOfSpeech: string;
		translation: string;
		explanation: string;
		/** Shown under the explanation when the panel isn't next to the sentence itself. */
		sentence?: string;
		saved: boolean;
	};

	export type WordLookup = 'idle' | 'loading' | 'error' | WordLookupResult;
</script>

<script lang="ts">
	import SpeakButton from './SpeakButton.svelte';

	// Side panel with the word the learner clicked (chat messages, clip
	// transcripts): beside the content on wide screens, a drawer on phones.
	let {
		lookup,
		language,
		idleText,
		open,
		onclose,
		onsave
	}: {
		lookup: WordLookup;
		language?: string | null;
		idleText: string;
		/** Phones only: whether the drawer is showing. */
		open: boolean;
		onclose: () => void;
		onsave: () => void;
	} = $props();

	const WORD_POS_LABELS: Record<string, string> = {
		noun: 'Sustantivo',
		verb: 'Verbo',
		adjective: 'Adjetivo',
		adverb: 'Adverbio',
		other: 'Otro'
	};
</script>

{#if open}
	<button
		type="button"
		aria-label="Cerrar"
		onclick={onclose}
		class="fixed inset-0 z-30 bg-black/40 sm:hidden"
	></button>
{/if}

<aside
	class="fixed inset-y-0 right-0 z-40 w-72 max-w-[85%] shrink-0 flex-col gap-3 overflow-y-auto border-l p-4 shadow-xl sm:static sm:z-auto sm:flex sm:max-w-none sm:border-t-0 sm:p-0 sm:pl-4 sm:shadow-none"
	style:border-color="var(--color-border)"
	style:background-color="var(--color-background)"
	class:hidden={!open}
	class:flex={open}
>
	<div class="flex items-center justify-between">
		<h2 class="text-sm font-medium" style:color="var(--color-ink-muted)">Palabra</h2>
		<button type="button" onclick={onclose} aria-label="Cerrar" class="rounded-md p-1 sm:hidden">
			<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" style:color="var(--color-ink)">
				<path
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					d="M6 6l12 12M18 6L6 18"
				/>
			</svg>
		</button>
	</div>
	{#if lookup === 'idle'}
		<p class="text-xs" style:color="var(--color-ink-muted)">{idleText}</p>
	{:else if lookup === 'loading'}
		<p class="text-xs italic" style:color="var(--color-ink-muted)">Analizando...</p>
	{:else if lookup === 'error'}
		<p class="text-xs" style:color="#f87171">No se pudo analizar la palabra.</p>
	{:else}
		<div class="flex flex-col gap-2 text-sm">
			<div class="flex items-center gap-2">
				<span class="font-medium">{lookup.word}</span>
				<SpeakButton text={lookup.word} {language} />
			</div>
			<span class="text-xs" style:color="var(--color-ink-muted)">
				{WORD_POS_LABELS[lookup.partOfSpeech] ?? lookup.partOfSpeech}
			</span>
			<p>{lookup.translation}</p>
			<p class="text-xs" style:color="var(--color-ink-muted)">{lookup.explanation}</p>
			{#if lookup.sentence}
				<p class="text-xs italic" style:color="var(--color-ink-muted)">{lookup.sentence}</p>
			{/if}
			<button
				type="button"
				onclick={onsave}
				disabled={lookup.saved}
				class="w-fit rounded-md px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
				style:background-color="var(--color-accent)"
			>
				{lookup.saved ? 'Añadida al libro de estudio' : 'Añadir al libro de estudio'}
			</button>
		</div>
	{/if}
</aside>
