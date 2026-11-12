<script lang="ts">
	import { aiTaskLabel } from '$lib/aiTasks';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const usd = new Intl.NumberFormat('es', { style: 'currency', currency: 'USD' });
	const usdFine = new Intl.NumberFormat('es', {
		style: 'currency',
		currency: 'USD',
		maximumSignificantDigits: 2
	});

	/** Cents as cents; fractions of a cent with two significant digits. */
	function money(value: number) {
		if (value === 0) return usd.format(0);
		return value < 0.01 ? usdFine.format(value) : usd.format(value);
	}

	function weekLabel(start: string, style: 'short' | 'long' = 'short') {
		return new Date(`${start}T00:00:00Z`).toLocaleDateString('es', {
			day: 'numeric',
			month: style === 'short' ? 'short' : 'long',
			timeZone: 'UTC'
		});
	}

	function monthLabel(start: string) {
		return new Date(`${start}T00:00:00Z`).toLocaleDateString('es', {
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		});
	}

	const maxWeek = $derived(Math.max(...data.byWeek.map((w) => w.cost), 0.000001));
	const maxTask = $derived(Math.max(...data.byTask.map((t) => t.cost), 0.000001));
	const anyEstimate = $derived(
		[data.thisWeek, data.thisMonth, data.allTime].some((t) => t.estimated)
	);
	const anyUnknown = $derived(data.allTime.unknown > 0);
</script>

<svelte:head><title>Gasto en IA · Langua</title></svelte:head>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-3 sm:p-6">
	<div class="flex flex-col gap-1">
		<h1 class="text-xl font-semibold">Gasto en IA</h1>
		<p class="text-sm text-ink-muted">
			Lo que ha costado la IA que has usado tú. Lo paga tu familia a través de Seilide (Gastos →
			IA), en dólares, como lo cobra OpenRouter.
		</p>
	</div>

	<section class="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Resumen">
		{#each [{ label: 'Esta semana', totals: data.thisWeek }, { label: 'Este mes', totals: data.thisMonth }, { label: 'Desde el principio', totals: data.allTime }] as tile (tile.label)}
			<div class="rounded-lg border border-border bg-surface p-4">
				<h2 class="text-sm text-ink-muted">{tile.label}</h2>
				<p class="mt-1 text-2xl font-semibold">
					{tile.totals.estimated ? '≈ ' : ''}{money(tile.totals.cost)}
				</p>
				<p class="text-xs text-ink-muted">
					{tile.totals.calls}
					{tile.totals.calls === 1 ? 'uso' : 'usos'}
				</p>
			</div>
		{/each}
	</section>

	<section class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h2 class="text-sm font-medium">Por tipo de acción</h2>
			<!-- A GET form: the period is in the URL, so it can be shared and reloaded. -->
			<form method="GET" role="group" aria-label="Periodo" class="flex flex-wrap gap-1">
				{#each Object.entries(data.periods) as [key, label] (key)}
					<button
						name="periodo"
						value={key}
						aria-pressed={data.period === key}
						class={[
							'inline-flex min-h-8 items-center rounded-full border px-2.5 text-xs',
							data.period === key
								? 'border-accent bg-background font-medium text-accent'
								: 'border-border text-ink-muted'
						]}>{label}</button
					>
				{/each}
			</form>
		</div>

		{#if data.byTask.length === 0}
			<p class="text-sm text-ink-muted">Sin uso de IA en este periodo.</p>
		{:else}
			<table class="w-full text-left text-sm">
				<caption class="sr-only">Gasto por tipo de acción, {data.periods[data.period]}</caption>
				<thead>
					<tr class="border-b border-border text-xs text-ink-muted">
						<th scope="col" class="py-1.5 pr-2 font-medium">Acción</th>
						<th scope="col" class="py-1.5 pr-2 text-right font-medium">Usos</th>
						<th scope="col" class="py-1.5 text-right font-medium">Coste</th>
					</tr>
				</thead>
				<tbody>
					{#each data.byTask as row (row.task)}
						<tr class="border-b border-border">
							<th scope="row" class="py-2 pr-2 font-normal">
								{aiTaskLabel(row.task)}
								{#if row.unknown < row.calls}
									<div class="mt-1 h-1.5 rounded-full bg-background" aria-hidden="true">
										<div
											class="h-full rounded-full bg-accent"
											style:width="{Math.max(1, (row.cost / maxTask) * 100)}%"
										></div>
									</div>
								{/if}
								{#if row.characters > 0}
									<span class="text-xs text-ink-muted">
										{row.characters.toLocaleString('es')} caracteres leídos
									</span>
								{/if}
							</th>
							<td class="py-2 pr-2 text-right tabular-nums">{row.calls}</td>
							<td class="py-2 text-right tabular-nums">
								{#if row.unknown === row.calls}
									<span class="text-ink-muted">no disponible</span>
								{:else}
									{row.estimated ? '≈ ' : ''}{money(row.cost)}{row.unknown > 0 ? ' *' : ''}
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	<section class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
		<h2 class="text-sm font-medium">Por semana (últimas 12)</h2>
		<div class="flex h-32 items-end gap-0.5" aria-hidden="true">
			{#each data.byWeek as week, i (week.start)}
				<div class="group relative flex h-full flex-1 flex-col justify-end">
					{#if week.cost > 0}
						<div
							class="w-full rounded-t bg-accent group-hover:opacity-80"
							style:height="{Math.max(4, (week.cost / maxWeek) * 100)}%"
						></div>
					{:else}
						<div class="h-0.5 w-full rounded bg-border"></div>
					{/if}
					<div
						class={[
							'pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max rounded-md border border-border bg-background px-2 py-1 text-xs shadow group-hover:block',
							i < 3
								? 'left-0'
								: i > data.byWeek.length - 4
									? 'right-0'
									: 'left-1/2 -translate-x-1/2'
						]}
					>
						<p class="font-medium">Semana del {weekLabel(week.start, 'long')}</p>
						<p class="text-ink-muted">
							{week.estimated ? '≈ ' : ''}{money(week.cost)} · {week.calls} usos
						</p>
					</div>
				</div>
			{/each}
		</div>
		<div class="flex gap-0.5" aria-hidden="true">
			{#each data.byWeek as week, i (week.start)}
				<span class="flex-1 text-center text-[11px] whitespace-nowrap text-ink-muted">
					{i % 3 === 2 ? weekLabel(week.start) : ''}
				</span>
			{/each}
		</div>
		<details class="text-sm">
			<summary class="cursor-pointer text-ink-muted">Ver como tabla</summary>
			<table class="mt-2 w-full text-left text-xs">
				<caption class="sr-only">Gasto por semana, últimas 12 semanas</caption>
				<thead>
					<tr class="border-b border-border">
						<th scope="col" class="py-1 pr-2 font-medium">Semana del</th>
						<th scope="col" class="py-1 pr-2 text-right font-medium">Usos</th>
						<th scope="col" class="py-1 text-right font-medium">Coste</th>
					</tr>
				</thead>
				<tbody>
					{#each data.byWeek as week (week.start)}
						<tr class="border-b border-border">
							<th scope="row" class="py-1 pr-2 font-normal">{weekLabel(week.start, 'long')}</th>
							<td class="py-1 pr-2 text-right tabular-nums">{week.calls}</td>
							<td class="py-1 text-right tabular-nums">
								{week.estimated ? '≈ ' : ''}{money(week.cost)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</details>
	</section>

	<section class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
		<h2 class="text-sm font-medium">Por mes</h2>
		{#if data.byMonth.length === 0}
			<p class="text-sm text-ink-muted">Todavía no hay uso de IA.</p>
		{:else}
			<table class="w-full text-left text-sm">
				<caption class="sr-only">Gasto por mes, últimos 12 meses</caption>
				<thead>
					<tr class="border-b border-border text-xs text-ink-muted">
						<th scope="col" class="py-1.5 pr-2 font-medium">Mes</th>
						<th scope="col" class="py-1.5 pr-2 text-right font-medium">Usos</th>
						<th scope="col" class="py-1.5 text-right font-medium">Coste</th>
					</tr>
				</thead>
				<tbody>
					{#each data.byMonth as month (month.start)}
						<tr class="border-b border-border">
							<th scope="row" class="py-2 pr-2 font-normal first-letter:uppercase">
								{monthLabel(month.start)}
							</th>
							<td class="py-2 pr-2 text-right tabular-nums">{month.calls}</td>
							<td class="py-2 text-right tabular-nums">
								{month.estimated ? '≈ ' : ''}{money(month.cost)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	{#if anyEstimate || anyUnknown}
		<div class="flex flex-col gap-1 text-xs text-ink-muted">
			{#if anyEstimate}
				<p>
					≈ Incluye estimaciones: tokens × precio de lista, cuando la respuesta no traía el coste.
				</p>
			{/if}
			{#if anyUnknown}
				<p>
					* La voz llega sin su coste, así que no se suma: se cuentan los usos y los caracteres. Las
					frases que ya estaban en la caché no se vuelven a pagar ni aparecen.
				</p>
			{/if}
		</div>
	{/if}
</div>
