<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import SpeakButton from '$lib/components/SpeakButton.svelte';
	import { announcer } from '$lib/announcer.svelte';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type CardData = PageData['cards'][number];
	type RatingKey = '1' | '2' | '3' | '4';

	const ANSWERS: { rating: RatingKey; label: string; variant: 'secondary' | 'primary' }[] = [
		{ rating: '1', label: 'Otra vez', variant: 'secondary' },
		{ rating: '2', label: 'Difícil', variant: 'secondary' },
		{ rating: '3', label: 'Bien', variant: 'primary' },
		{ rating: '4', label: 'Fácil', variant: 'secondary' }
	];

	/** A card answered «Otra vez» comes back in this same session if it's due this soon. */
	const REQUEUE_WITHIN_MS = 20 * 60_000;

	// The session's cards: taken once from the load, then worked through here.
	let queue = $state<CardData[]>(untrack(() => [...data.cards]));
	let reviewed = $state(0);
	let revealed = $state(false);
	let saving = $state(false);
	let failure = $state('');

	let card = $derived(queue[0]);

	function untilLabel(iso: string) {
		const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
		if (minutes < 60) return `${Math.max(minutes, 1)} min`;
		const hours = Math.round(minutes / 60);
		if (hours < 24) return `${hours} h`;
		const days = Math.round(hours / 24);
		if (days < 31) return `${days} ${days === 1 ? 'día' : 'días'}`;
		const months = Math.round(days / 30);
		return `${months} ${months === 1 ? 'mes' : 'meses'}`;
	}

	function reveal() {
		revealed = true;
		if (card) announcer.say(`${card.translation}. ${card.exampleSentence}`);
	}

	async function grade(rating: RatingKey) {
		if (!card || saving) return;
		saving = true;
		failure = '';
		const current = card;
		const body = new FormData();
		body.set('id', current.id);
		body.set('rating', rating);
		try {
			const response = await fetch('?/grade', { method: 'POST', body });
			const result = deserialize(await response.text());
			if (result.type !== 'success' || !result.data) throw new Error(result.type);
			const { dueAt, nextDue } = result.data as { dueAt: string; nextDue: CardData['nextDue'] };

			reviewed++;
			const rest = queue.slice(1);
			queue =
				new Date(dueAt).getTime() - Date.now() < REQUEUE_WITHIN_MS
					? [...rest, { ...current, isNew: false, nextDue }]
					: rest;
			revealed = false;
			announcer.say(queue.length > 0 ? `Siguiente: ${queue[0].word}` : 'Repaso terminado.');
		} catch {
			failure = 'No se pudo guardar la respuesta. Inténtalo otra vez.';
			announcer.alert(failure);
		} finally {
			saving = false;
		}
	}

	async function nextBatch() {
		await invalidateAll();
		queue = [...data.cards];
		reviewed = 0;
	}

	function onKeydown(event: KeyboardEvent) {
		if (!card || event.target instanceof HTMLInputElement) return;
		if (!revealed && (event.key === ' ' || event.key === 'Enter')) {
			event.preventDefault();
			reveal();
		} else if (revealed && ['1', '2', '3', '4'].includes(event.key)) {
			event.preventDefault();
			grade(event.key as RatingKey);
		}
	}
</script>

<svelte:head><title>Repasar · Langua</title></svelte:head>
<svelte:window onkeydown={onKeydown} />

<div class="mx-auto flex w-full max-w-xl flex-col gap-6 p-3 sm:p-6">
	<div class="flex items-center justify-between gap-2">
		<h1 class="text-lg font-semibold">Repasar vocabulario</h1>
		<a href={resolve('/study')} class="text-sm text-accent underline">Libro de estudio</a>
	</div>

	{#if card}
		<p class="text-sm text-ink-muted" aria-live="off">
			{reviewed} repasadas · quedan {queue.length}{data.due > data.cards.length
				? ` (de ${data.due} pendientes)`
				: ''}
		</p>

		<section
			aria-label="Tarjeta"
			class="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface p-6 text-center"
		>
			{#if card.isNew}
				<span class="rounded-full border border-accent px-2 py-0.5 text-xs text-accent">Nueva</span>
			{/if}
			<div class="flex items-center gap-2">
				<p class="text-2xl font-semibold" lang={card.targetLanguage}>{card.word}</p>
				<SpeakButton text={card.word} language={card.targetLanguage} style="word" />
			</div>

			{#if revealed}
				<p class="text-lg">{card.translation}</p>
				<div class="flex items-center gap-2">
					<p class="text-sm text-ink-muted italic" lang={card.targetLanguage}>
						{card.exampleSentence}
					</p>
					<SpeakButton text={card.exampleSentence} language={card.targetLanguage} />
				</div>
			{:else}
				<Button onclick={reveal}>Mostrar respuesta</Button>
				<p class="text-xs text-ink-muted">Piensa qué significa y pulsa (o Espacio).</p>
			{/if}
		</section>

		{#if revealed}
			<div
				role="group"
				aria-label="¿Cómo la recordabas?"
				class="grid grid-cols-2 gap-2 sm:grid-cols-4"
			>
				{#each ANSWERS as answer (answer.rating)}
					<Button
						variant={answer.variant}
						disabled={saving}
						onclick={() => grade(answer.rating)}
						aria-keyshortcuts={answer.rating}
						class="flex-col"
					>
						<span>{answer.label}</span>
						<span class="text-xs opacity-80">{untilLabel(card.nextDue[answer.rating])}</span>
					</Button>
				{/each}
			</div>
			<p class="text-center text-xs text-ink-muted">Atajos: 1 · 2 · 3 · 4</p>
		{/if}

		{#if failure}
			<p class="text-sm text-danger">{failure}</p>
		{/if}
	{:else}
		<div class="flex flex-col items-start gap-3">
			<p>
				{reviewed > 0
					? `¡Hecho! Has repasado ${reviewed} ${reviewed === 1 ? 'palabra' : 'palabras'}.`
					: 'No tienes palabras pendientes de repasar ahora mismo.'}
			</p>
			{#if data.due > data.cards.length && reviewed > 0}
				<Button onclick={nextBatch}>Seguir con las siguientes</Button>
			{/if}
			<a href={resolve('/study')} class="text-sm text-accent underline"
				>Volver al libro de estudio</a
			>
		</div>
	{/if}
</div>
