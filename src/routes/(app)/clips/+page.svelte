<script lang="ts">
	import { resolve } from '$app/paths';
	import { clipOrigin } from '$lib/clips';
	import { LANGUAGES } from '$lib/languages';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const dateFormatter = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

	function languageLabel(code: string | null) {
		return LANGUAGES.find((lang) => lang.code === code)?.label ?? 'Idioma desconocido';
	}
</script>

<div class="mx-auto flex max-w-2xl flex-col gap-6 p-6">
	<header>
		<h1 class="text-xl font-semibold">Clips</h1>
		<p class="text-sm" style:color="var(--color-ink-muted)">
			Fragmentos de series y películas que te mandas desde JellyCartoon.
		</p>
	</header>

	{#if data.clips.length === 0}
		<p class="text-sm" style:color="var(--color-ink-muted)">
			Aún no tienes clips. Mientras ves algo en JellyCartoon, di «manda los últimos 5 minutos a
			Langua». Antes tendrás que crear un token en
			<a href={resolve('/account')} class="underline">Mi cuenta</a>.
		</p>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each data.clips as clip (clip.id)}
				<li>
					<a
						href={resolve('/(app)/clips/[id]', { id: clip.id })}
						class="flex flex-col gap-0.5 rounded-lg border p-3"
						style:border-color="var(--color-border)"
						style:background-color="var(--color-surface)"
					>
						<span class="font-medium">{clipOrigin(clip)}</span>
						{#if clip.kind === 'episode' && clip.series}
							<span class="text-sm">{clip.title}</span>
						{/if}
						<span class="text-xs" style:color="var(--color-ink-muted)">
							{dateFormatter.format(clip.capturedAt)} · {languageLabel(clip.language)}
							{#if clip.transcriptionStatus === 'pending'}
								· transcribiendo…
							{:else if clip.transcriptionStatus === 'failed'}
								· <span class="text-red-600">sin transcripción</span>
							{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
