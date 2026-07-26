<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const maxCount = $derived(Math.max(1, ...data.recentDays.map((d) => d.count)));

	function intensity(count: number) {
		if (count === 0) return 'var(--color-background)';
		const ratio = count / maxCount;
		return ratio > 0.66
			? 'var(--color-accent)'
			: ratio > 0.33
				? 'var(--color-ink-muted)'
				: 'var(--color-border)';
	}

	function formatDay(date: string) {
		return new Date(`${date}T00:00:00Z`).toLocaleDateString('es', {
			weekday: 'short',
			day: 'numeric'
		});
	}
</script>

<div class="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
	<header class="flex items-center justify-between">
		<h1 class="text-xl font-semibold">Progreso</h1>
		<a href={resolve('/')} class="text-sm underline" style:color="var(--color-ink-muted)">
			Volver
		</a>
	</header>

	<section
		class="flex items-center justify-between rounded-lg border p-4"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-surface)"
	>
		<div>
			<p class="text-3xl font-semibold" style:color="var(--color-accent)">{data.streak}</p>
			<p class="text-sm" style:color="var(--color-ink-muted)">
				{data.streak === 1 ? 'día seguido' : 'días seguidos'}
			</p>
		</div>
	</section>

	<section
		class="rounded-lg border p-4"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-surface)"
	>
		<h2 class="mb-3 text-sm font-medium">Últimos 14 días</h2>
		<div class="flex items-end justify-between gap-1">
			{#each data.recentDays as day (day.date)}
				<div class="flex flex-1 flex-col items-center gap-1">
					<div
						class="h-8 w-full rounded"
						style:background-color={intensity(day.count)}
						title="{formatDay(day.date)}: {day.count}"
					></div>
					<span class="text-[10px]" style:color="var(--color-ink-muted)">{formatDay(day.date)}</span
					>
				</div>
			{/each}
		</div>
	</section>

	<section class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div
			class="rounded-lg border p-4"
			style:border-color="var(--color-border)"
			style:background-color="var(--color-surface)"
		>
			<h2 class="text-sm font-medium">Chat</h2>
			<p class="mt-2 text-2xl font-semibold">{data.totals.chatMessages}</p>
			<p class="text-sm" style:color="var(--color-ink-muted)">mensajes enviados</p>
		</div>

		<div
			class="rounded-lg border p-4"
			style:border-color="var(--color-border)"
			style:background-color="var(--color-surface)"
		>
			<h2 class="text-sm font-medium">Escuchar</h2>
			<p class="mt-2 text-2xl font-semibold">{data.totals.listeningAttempts}</p>
			<p class="text-sm" style:color="var(--color-ink-muted)">
				ejercicios
				{#if data.totals.listeningAvgScore !== null}
					· {data.totals.listeningAvgScore}/100 de media
				{/if}
			</p>
		</div>
	</section>
</div>
