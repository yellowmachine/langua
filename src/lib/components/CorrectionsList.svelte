<script lang="ts">
	type Correction = { original: string; correction: string; explanation: string };

	let {
		corrections,
		overallFeedback,
		language
	}: {
		corrections: Correction[];
		overallFeedback: string | null;
		/** Language of the corrected text, so screen readers pronounce it right. */
		language?: string | null;
	} = $props();
</script>

{#if corrections.length === 0}
	<p class="text-sm" style:color="var(--color-ink-muted)">
		{overallFeedback ?? 'No se han encontrado errores.'}
	</p>
{:else}
	<ul class="flex flex-col gap-2">
		{#each corrections as item, i (i)}
			<li
				class="flex flex-col gap-1 rounded-md border px-3 py-2 text-sm"
				style:border-color="var(--color-border)"
			>
				<p lang={language ?? undefined}>
					<span style:color="var(--color-danger)" style:text-decoration="line-through"
						>{item.original}</span
					>
				</p>
				<p lang={language ?? undefined} style:color="var(--color-accent)">{item.correction}</p>
				<p class="text-xs italic" style:color="var(--color-ink-muted)">{item.explanation}</p>
			</li>
		{/each}
	</ul>
	{#if overallFeedback}
		<p class="text-sm" style:color="var(--color-ink-muted)">{overallFeedback}</p>
	{/if}
{/if}
