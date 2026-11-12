<script lang="ts">
	import { resolve } from '$app/paths';
	import SpeakButton from '$lib/components/SpeakButton.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let attempt = $derived(data.attempt);

	const LETTERS = ['A', 'B', 'C', 'D'];
</script>

<svelte:head><title>Ejercicio de escucha · Langua</title></svelte:head>

<div class="mx-auto flex w-full max-w-2xl flex-col gap-6 p-3 sm:p-6">
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<h1 class="text-xl font-semibold">Ejercicio de escucha</h1>
		<a href={resolve('/listen')} class="text-sm text-accent underline">Volver a Escuchar</a>
	</div>

	<p class="text-sm text-ink-muted">
		{new Date(attempt.createdAt).toLocaleString('es')} ·
		<strong class="text-ink">{attempt.score}/100</strong>
	</p>

	<section class="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
		<div class="flex items-center gap-2">
			<SpeakButton text={attempt.passage} language={attempt.targetLanguage} style="narration" />
			<span class="text-sm text-ink-muted">Escuchar otra vez</span>
		</div>
		<p lang={attempt.targetLanguage}>{attempt.passage}</p>
	</section>

	<ol class="flex flex-col gap-4">
		{#each attempt.questions as question, qi (qi)}
			<li class="flex flex-col gap-1.5">
				<p class="font-medium" lang={attempt.targetLanguage}>{qi + 1}. {question.question}</p>
				<ul class="flex flex-col gap-1 text-sm">
					{#each question.options as option, oi (oi)}
						{@const correct = oi === question.correctIndex}
						{@const chosen = oi === question.selectedIndex}
						<li
							class={[
								'flex items-center gap-2 rounded-md border px-2 py-1.5',
								correct ? 'border-accent' : chosen ? 'border-danger' : 'border-transparent'
							]}
						>
							<span class="w-4 text-ink-muted" aria-hidden="true">{LETTERS[oi]}</span>
							<span class="flex-1" lang={attempt.targetLanguage}>{option}</span>
							{#if correct}
								<span class="text-xs font-medium text-accent">
									{chosen ? '✓ tu respuesta, correcta' : '✓ correcta'}
								</span>
							{:else if chosen}
								<span class="text-xs font-medium text-danger">✗ tu respuesta</span>
							{/if}
						</li>
					{/each}
				</ul>
			</li>
		{/each}
	</ol>
</div>
