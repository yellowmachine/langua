<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { announcer } from '$lib/announcer.svelte';
	import SpeakButton from '$lib/components/SpeakButton.svelte';
	import { LANGUAGES } from '$lib/languages';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let sourceLanguage = $state(data.user.nativeLanguage ?? LANGUAGES[0].code);
	let targetLanguage = $state(data.user.targetLanguage ?? LANGUAGES[1].code);
	let text = $state('');
	let result: 'idle' | 'loading' | string | 'error' = $state('idle');
	// Language the shown translation is in (the selects may change afterwards).
	let resultLanguage = $state('');

	function swapLanguages() {
		[sourceLanguage, targetLanguage] = [targetLanguage, sourceLanguage];
	}

	async function translate() {
		const trimmed = text.trim();
		if (!trimmed) return;

		result = 'loading';
		const toLanguage = targetLanguage;
		try {
			const response = await fetch('/translate/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text: trimmed,
					fromLanguage: sourceLanguage,
					toLanguage
				})
			});
			if (!response.ok) {
				result = 'error';
				announcer.alert('No se pudo traducir el texto.');
				return;
			}
			const data: { translation: string } = await response.json();
			resultLanguage = toLanguage;
			result = data.translation;
			announcer.say(`Traducción: ${data.translation}`);
		} catch {
			result = 'error';
			announcer.alert('No se pudo traducir el texto.');
		}
	}
</script>

<svelte:head><title>Traducir · Langua</title></svelte:head>

<div class="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
	<h1 class="text-lg font-semibold">Traducir</h1>

	<div class="flex items-center gap-2">
		<select
			bind:value={sourceLanguage}
			aria-label="Idioma de origen"
			class="flex-1 rounded-md border px-3 py-2 text-sm"
			style:border-color="var(--color-border)"
			style:background-color="var(--color-surface)"
		>
			{#each LANGUAGES as lang (lang.code)}
				<option value={lang.code}>{lang.label}</option>
			{/each}
		</select>

		<button
			type="button"
			onclick={swapLanguages}
			aria-label="Intercambiar idiomas"
			class="shrink-0 rounded-md border p-2"
			style:border-color="var(--color-border)"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" style:color="var(--color-ink)">
				<path
					stroke="currentColor"
					stroke-width="1.6"
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M7 7h13m0 0-4-4m4 4-4 4M17 17H4m0 0 4 4m-4-4 4-4"
				/>
			</svg>
		</button>

		<select
			bind:value={targetLanguage}
			aria-label="Idioma de destino"
			class="flex-1 rounded-md border px-3 py-2 text-sm"
			style:border-color="var(--color-border)"
			style:background-color="var(--color-surface)"
		>
			{#each LANGUAGES as lang (lang.code)}
				<option value={lang.code}>{lang.label}</option>
			{/each}
		</select>
	</div>

	<textarea
		bind:value={text}
		lang={sourceLanguage}
		aria-label="Texto a traducir"
		rows="5"
		placeholder="Escribe el texto a traducir..."
		class="rounded-md border px-3 py-2 text-sm"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-background)"></textarea>

	<Button class="w-fit" onclick={translate} disabled={result === 'loading' || !text.trim()}>
		{result === 'loading' ? 'Traduciendo...' : 'Traducir'}
	</Button>

	{#if result === 'error'}
		<p class="text-sm" style:color="var(--color-danger)">No se pudo traducir el texto.</p>
	{:else if result !== 'idle' && result !== 'loading'}
		<div
			class="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
			style:border-color="var(--color-border)"
			style:background-color="var(--color-surface)"
		>
			<p class="flex-1" lang={resultLanguage}>{result}</p>
			<SpeakButton text={result} language={resultLanguage} />
		</div>
	{/if}
</div>
