<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { clipOrigin, formatTimestamp } from '$lib/clips';
	import { LANGUAGES } from '$lib/languages';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const dateFormatter = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

	let audio: HTMLAudioElement | undefined = $state();
	let currentTime = $state(0);
	let confirmingDelete = $state(false);

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
				<button
					{@attach scrollIntoViewWhen(i === activeIndex)}
					type="button"
					onclick={() => playFrom(cue.start)}
					class="flex gap-3 rounded-md px-2 py-1.5 text-left"
					style:background-color={i === activeIndex ? 'var(--color-background)' : 'transparent'}
					style:font-weight={i === activeIndex ? '600' : '400'}
				>
					<span class="shrink-0 font-mono text-xs leading-6" style:color="var(--color-ink-muted)">
						{formatTimestamp(cue.start)}
					</span>
					<span class="whitespace-pre-line">{cue.text}</span>
				</button>
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
