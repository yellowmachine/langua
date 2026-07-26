<script lang="ts">
	import { resolve } from '$app/paths';
	import SpeakButton from '$lib/components/SpeakButton.svelte';
	import { LANGUAGES } from '$lib/languages';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const posLabels: Record<string, string> = {
		noun: 'Sustantivos',
		verb: 'Verbos',
		adjective: 'Adjetivos',
		adverb: 'Adverbios',
		other: 'Otros'
	};

	function languageLabel(code: string) {
		return LANGUAGES.find((lang) => lang.code === code)?.label ?? code;
	}

	let savedExtra: Record<string, { sentence: string; translation: string }[]> = $state({});
	let extraByItemId = $derived.by(() =>
		Object.fromEntries(
			data.items.map((item) => [item.id, [...item.extraExamples, ...(savedExtra[item.id] ?? [])]])
		)
	);

	let searchQuery = $state('');
	let activeTag: string | null = $state(null);

	function toggleTag(tag: string) {
		activeTag = activeTag === tag ? null : tag;
	}

	let filteredItems = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		return data.items.filter(
			(item) =>
				(!activeTag || item.tags.includes(activeTag)) &&
				(!query ||
					item.word.toLowerCase().includes(query) ||
					item.translation.toLowerCase().includes(query))
		);
	});

	type Generation = 'idle' | 'loading' | { sentence: string; translation: string } | 'error';
	let generation: Record<string, Generation> = $state({});

	async function generateSentence(itemId: string) {
		generation[itemId] = 'loading';
		try {
			const response = await fetch(`/study/${itemId}/sentence`, { method: 'POST' });
			if (!response.ok) {
				generation[itemId] = 'error';
				return;
			}
			const result: { sentence: string; translation: string } = await response.json();
			generation[itemId] = { sentence: result.sentence, translation: result.translation };
		} catch {
			generation[itemId] = 'error';
		}
	}

	async function saveSentence(itemId: string) {
		const current = generation[itemId];
		if (current === 'idle' || current === 'loading' || current === 'error') return;

		try {
			const response = await fetch(`/study/${itemId}/sentence`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sentence: current.sentence, translation: current.translation })
			});
			if (!response.ok) return;
			savedExtra[itemId] = [...(savedExtra[itemId] ?? []), current];
			generation[itemId] = 'idle';
		} catch {
			// keep the generated sentence visible so the user can retry saving it
		}
	}

	function discardSentence(itemId: string) {
		generation[itemId] = 'idle';
	}

	let groups = $derived.by(() => {
		const byLanguage: Record<string, typeof data.items> = {};
		for (const item of filteredItems) {
			(byLanguage[item.targetLanguage] ??= []).push(item);
		}

		return Object.entries(byLanguage).map(([targetLanguage, items]) => {
			const byPos: Record<string, typeof items> = {};
			for (const item of items) {
				(byPos[item.partOfSpeech] ??= []).push(item);
			}
			return { targetLanguage, byPos: Object.entries(byPos) };
		});
	});
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
	<h1 class="text-lg font-semibold">Libro de estudio</h1>

	{#if data.items.length === 0}
		<p style:color="var(--color-ink-muted)">
			Todavía no hay vocabulario guardado. Extráelo desde una conversación en el
			<a href={resolve('/chat')} class="underline" style:color="var(--color-accent)">chat</a>.
		</p>
	{:else}
		<div class="flex flex-wrap items-center gap-2">
			<input
				bind:value={searchQuery}
				type="text"
				placeholder="Buscar palabra o traducción..."
				class="flex-1 rounded-md border px-3 py-2 text-sm"
				style:border-color="var(--color-border)"
				style:background-color="var(--color-background)"
			/>
			{#if activeTag}
				<button
					type="button"
					onclick={() => (activeTag = null)}
					class="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
					style:border-color="var(--color-accent)"
					style:color="var(--color-accent)"
				>
					{activeTag} ✕
				</button>
			{/if}
		</div>

		{#if filteredItems.length === 0}
			<p style:color="var(--color-ink-muted)">Sin resultados.</p>
		{/if}

		{#each groups as group (group.targetLanguage)}
			<section class="flex flex-col gap-4">
				<h2 class="text-base font-semibold">{languageLabel(group.targetLanguage)}</h2>
				{#each group.byPos as [partOfSpeech, items] (partOfSpeech)}
					<div class="flex flex-col gap-2">
						<h3 class="text-sm font-medium" style:color="var(--color-ink-muted)">
							{posLabels[partOfSpeech] ?? partOfSpeech}
						</h3>
						<ul class="flex flex-col gap-2">
							{#each items as item (item.id)}
								{@const state = generation[item.id] ?? 'idle'}
								<li
									class="flex flex-col gap-2 rounded-md border px-3 py-2 text-sm"
									style:border-color="var(--color-border)"
								>
									<div class="flex flex-wrap items-center gap-2">
										<span class="font-medium">{item.word}</span>
										<SpeakButton text={item.word} language={item.targetLanguage} />
										<span style:color="var(--color-ink-muted)">— {item.translation}</span>
									</div>

									{#if item.tags.length > 0}
										<div class="flex flex-wrap gap-1.5">
											{#each item.tags as tag (tag)}
												<button
													type="button"
													onclick={() => toggleTag(tag)}
													class="rounded-full border border-dashed px-2 py-0.5 text-xs"
													style:border-color={activeTag === tag
														? 'var(--color-accent)'
														: 'var(--color-border)'}
													style:color={activeTag === tag
														? 'var(--color-accent)'
														: 'var(--color-ink-muted)'}
												>
													{tag}
												</button>
											{/each}
										</div>
									{/if}

									<div class="flex items-center gap-2">
										<p class="text-xs italic" style:color="var(--color-ink-muted)">
											{item.exampleSentence}
										</p>
										<SpeakButton text={item.exampleSentence} language={item.targetLanguage} />
									</div>

									{#each extraByItemId[item.id] ?? [] as example, i (i)}
										<div class="flex items-center gap-2">
											<p class="text-xs italic" style:color="var(--color-ink-muted)">
												{example.sentence}
												<span style:color="var(--color-ink-muted)">— {example.translation}</span>
											</p>
											<SpeakButton text={example.sentence} language={item.targetLanguage} />
										</div>
									{/each}

									{#if state === 'idle'}
										<button
											type="button"
											onclick={() => generateSentence(item.id)}
											class="w-fit rounded-md border px-2.5 py-1 text-xs"
											style:border-color="var(--color-border)"
										>
											Generar frase
										</button>
									{:else if state === 'loading'}
										<span class="text-xs italic" style:color="var(--color-ink-muted)"
											>Generando...</span
										>
									{:else if state === 'error'}
										<div class="flex items-center gap-2">
											<span class="text-xs" style:color="#f87171">No se pudo generar la frase.</span
											>
											<button
												type="button"
												onclick={() => generateSentence(item.id)}
												class="text-xs underline"
												style:color="var(--color-accent)"
											>
												Reintentar
											</button>
										</div>
									{:else}
										<div class="flex flex-wrap items-center gap-2">
											<p class="text-xs italic">
												{state.sentence}
												<span style:color="var(--color-ink-muted)">— {state.translation}</span>
											</p>
											<SpeakButton text={state.sentence} language={item.targetLanguage} />
											<button
												type="button"
												onclick={() => saveSentence(item.id)}
												class="rounded-md px-2.5 py-1 text-xs font-medium text-white"
												style:background-color="var(--color-accent)"
											>
												Guardar
											</button>
											<button
												type="button"
												onclick={() => discardSentence(item.id)}
												class="rounded-md border px-2.5 py-1 text-xs"
												style:border-color="var(--color-border)"
											>
												Descartar
											</button>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</section>
		{/each}
	{/if}
</div>
