<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Activity = keyof PageData['totals'];

	const LABELS: Record<Activity, string> = {
		chat: 'Mensajes de chat',
		listening: 'Ejercicios de escucha',
		speaking: 'Frases dichas',
		reviews: 'Palabras repasadas',
		newWords: 'Palabras nuevas'
	};
	const ACTIVITIES = Object.keys(LABELS) as Activity[];

	const maxCount = $derived(Math.max(1, ...data.recentDays.map((d) => d.count)));
	const activeDays = $derived(data.recentDays.filter((d) => d.count > 0).length);

	function formatDay(date: string, style: 'short' | 'long' = 'short') {
		return new Date(`${date}T00:00:00Z`).toLocaleDateString('es', {
			weekday: style === 'short' ? 'narrow' : 'long',
			day: 'numeric',
			...(style === 'long' ? { month: 'long' } : {}),
			// The key is already the local day: don't shift it again.
			timeZone: 'UTC'
		});
	}

	function breakdown(counts: Record<Activity, number>) {
		return ACTIVITIES.filter((a) => counts[a] > 0).map((a) => `${LABELS[a]}: ${counts[a]}`);
	}
</script>

<svelte:head><title>Progreso · Langua</title></svelte:head>

<div class="mx-auto flex max-w-2xl flex-col gap-6 p-3 sm:p-6">
	<h1 class="text-xl font-semibold">Progreso</h1>

	<section class="flex items-baseline gap-3 rounded-lg border border-border bg-surface p-4">
		<p class="text-4xl font-semibold text-accent">{data.streak}</p>
		<p class="text-sm text-ink-muted">
			{data.streak === 1 ? 'día seguido practicando' : 'días seguidos practicando'}
		</p>
	</section>

	<section class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
		<div class="flex items-baseline justify-between gap-2">
			<h2 class="text-sm font-medium">Actividad de los últimos 14 días</h2>
			<p class="text-xs text-ink-muted">{activeDays} de 14 días</p>
		</div>

		<!-- Bars for sighted readers; the same numbers are in the table below. -->
		<div class="flex h-32 items-end gap-0.5" aria-hidden="true">
			{#each data.recentDays as day, i (day.date)}
				<div class="group relative flex h-full flex-1 flex-col justify-end">
					{#if day.count > 0}
						<div
							class="w-full rounded-t bg-accent transition-opacity group-hover:opacity-80"
							style:height="{Math.max(6, (day.count / maxCount) * 100)}%"
						></div>
					{:else}
						<div class="h-0.5 w-full rounded bg-border"></div>
					{/if}
					<div
						class={[
							'pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max max-w-48 rounded-md border border-border bg-background px-2 py-1 text-xs shadow group-hover:block',
							// Kept inside the card at both ends.
							i < 4
								? 'left-0'
								: i > data.recentDays.length - 5
									? 'right-0'
									: 'left-1/2 -translate-x-1/2'
						]}
					>
						<p class="font-medium">{formatDay(day.date, 'long')}</p>
						{#each breakdown(day.counts) as line (line)}
							<p class="text-ink-muted">{line}</p>
						{:else}
							<p class="text-ink-muted">Sin actividad</p>
						{/each}
					</div>
				</div>
			{/each}
		</div>
		<div class="flex gap-0.5" aria-hidden="true">
			{#each data.recentDays as day, i (day.date)}
				<span class="flex-1 text-center text-[11px] whitespace-nowrap text-ink-muted">
					{i % 2 === data.recentDays.length % 2 ? '' : formatDay(day.date)}
				</span>
			{/each}
		</div>

		<details class="text-sm">
			<summary class="cursor-pointer text-ink-muted">Ver como tabla</summary>
			<div class="mt-2 overflow-x-auto">
				<table class="w-full text-left text-xs">
					<caption class="sr-only">Actividad por día, últimos 14 días</caption>
					<thead>
						<tr class="border-b border-border">
							<th scope="col" class="py-1 pr-2 font-medium">Día</th>
							<th scope="col" class="py-1 pr-2 font-medium">Total</th>
							<th scope="col" class="py-1 font-medium">Detalle</th>
						</tr>
					</thead>
					<tbody>
						{#each data.recentDays as day (day.date)}
							<tr class="border-b border-border">
								<th scope="row" class="py-1 pr-2 font-normal">{formatDay(day.date, 'long')}</th>
								<td class="py-1 pr-2">{day.count}</td>
								<td class="py-1 text-ink-muted">{breakdown(day.counts).join(' · ') || '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
	</section>

	<section class="grid grid-cols-2 gap-3 sm:grid-cols-3">
		{#each ACTIVITIES as activity (activity)}
			<div class="rounded-lg border border-border bg-surface p-4">
				<p class="text-2xl font-semibold">{data.totals[activity]}</p>
				<h2 class="text-sm text-ink-muted">{LABELS[activity]}</h2>
				{#if activity === 'listening' && data.averages.listening !== null}
					<p class="mt-1 text-xs text-ink-muted">{data.averages.listening}/100 de media</p>
				{:else if activity === 'speaking' && data.averages.speaking !== null}
					<p class="mt-1 text-xs text-ink-muted">{data.averages.speaking}/100 de media</p>
				{/if}
			</div>
		{/each}
	</section>
</div>
