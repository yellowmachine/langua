<script lang="ts">
	import { untrack } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Chip from '$lib/components/ui/Chip.svelte';
	import { announcer } from '$lib/announcer.svelte';
	import { enhance } from '$app/forms';
	import SpeakButton from '$lib/components/SpeakButton.svelte';
	import { LANGUAGES } from '$lib/languages';
	import { LEVELS } from '$lib/levels';
	import { LISTENING_EXERCISE_TYPES } from '$lib/listeningExerciseTypes';
	import type { PageData } from './$types';

	// The correct answers only come back once the exercise has been graded.
	type Question = { question: string; options: string[] };
	type GradedQuestion = Question & { correctIndex: number; selectedIndex: number };

	let { data }: { data: PageData } = $props();

	// The account's languages are only the starting choice: the selects own it.
	let targetLanguage = $state(untrack(() => data.user.targetLanguage ?? LANGUAGES[0].code));
	let level = $state<(typeof LEVELS)[number]['code']>('beginner');
	let exerciseType = $state('');

	let exercise = $state<{
		exerciseId: string;
		passage: string;
		questions: Question[];
		language: string;
	} | null>(null);
	let selected = $state<number[]>([]);
	let generating = $state(false);
	let submitting = $state(false);
	let result = $state<{ graded: GradedQuestion[]; score: number } | null>(null);
	let failure = $state('');

	function scoreColor(score: number) {
		if (score >= 85) return 'var(--color-accent)';
		if (score >= 60) return 'var(--color-ink)';
		return 'var(--color-danger)';
	}

	let allAnswered = $derived(
		exercise !== null &&
			selected.length === exercise.questions.length &&
			selected.every((s) => s >= 0)
	);
</script>

<svelte:head><title>Escuchar · Langua</title></svelte:head>

<div class="mx-auto flex max-w-2xl flex-col gap-6 p-6">
	<header>
		<h1 class="text-xl font-semibold">Escuchar</h1>
	</header>

	<section
		class="flex flex-col gap-4 rounded-lg border p-4"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-surface)"
	>
		<form
			method="POST"
			action="?/newExercise"
			use:enhance={() => {
				generating = true;
				result = null;
				failure = '';
				return async ({ result: actionResult }) => {
					generating = false;
					if (actionResult.type === 'success' && actionResult.data) {
						exercise = {
							...(actionResult.data as {
								exerciseId: string;
								passage: string;
								questions: Question[];
							}),
							language: targetLanguage
						};
						selected = exercise.questions.map(() => -1);
						announcer.say('Ejercicio listo. Pulsa escuchar y responde a las preguntas.');
					} else {
						failure = 'No se pudo crear el ejercicio. Inténtalo otra vez.';
						announcer.alert(failure);
					}
				};
			}}
			class="flex flex-wrap items-end gap-3"
		>
			<label class="flex flex-col gap-1 text-sm">
				Idioma
				<select
					bind:value={targetLanguage}
					name="targetLanguage"
					class="rounded-md border py-2 pr-9 pl-3"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-background)"
				>
					{#each LANGUAGES as lang (lang.code)}
						<option value={lang.code}>{lang.label}</option>
					{/each}
				</select>
			</label>

			<label class="flex flex-col gap-1 text-sm">
				Nivel
				<select
					bind:value={level}
					name="level"
					class="rounded-md border py-2 pr-9 pl-3"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-background)"
				>
					{#each LEVELS as lvl (lvl.code)}
						<option value={lvl.code}>{lvl.label}</option>
					{/each}
				</select>
			</label>

			<Button type="submit" disabled={generating || submitting}>
				{generating ? 'Generando...' : exercise ? 'Otro ejercicio' : 'Nuevo ejercicio'}
			</Button>

			<div class="flex w-full flex-wrap gap-1.5">
				{#each LISTENING_EXERCISE_TYPES as type (type.label)}
					<Chip onclick={() => (exerciseType = type.prompt)}>
						{type.label}
					</Chip>
				{/each}
			</div>

			<label class="flex w-full flex-col gap-1 text-sm">
				Tipo de ejercicio (opcional)
				<input
					bind:value={exerciseType}
					name="exerciseType"
					type="text"
					placeholder="Cualquiera"
					class="rounded-md border px-3 py-2"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-background)"
				/>
			</label>
		</form>

		{#if failure}
			<p class="text-sm" style:color="var(--color-danger)">{failure}</p>
		{/if}

		{#if exercise}
			<div class="flex items-center gap-2">
				<SpeakButton text={exercise.passage} language={exercise.language} style="narration" />
				<span class="text-sm" style:color="var(--color-ink-muted)">Escucha el audio</span>
			</div>

			<form
				method="POST"
				action="?/submit"
				use:enhance={() => {
					submitting = true;
					failure = '';
					return async ({ result: actionResult }) => {
						submitting = false;
						if (actionResult.type === 'success' && actionResult.data) {
							result = actionResult.data as { graded: GradedQuestion[]; score: number };
							announcer.say(`Puntuación: ${result.score} de 100`);
						} else {
							failure = 'No se pudieron comprobar las respuestas. Inténtalo otra vez.';
							announcer.alert(failure);
						}
					};
				}}
				class="flex flex-col gap-4"
			>
				<input type="hidden" name="exerciseId" value={exercise.exerciseId} />
				<input type="hidden" name="answers" value={JSON.stringify(selected)} />

				{#each exercise.questions as question, qi (qi)}
					<fieldset class="flex flex-col gap-1.5" lang={exercise.language}>
						<legend class="text-sm font-medium">{question.question}</legend>
						{#each question.options as option, oi (oi)}
							<label class="flex items-center gap-2 text-sm">
								<input type="radio" bind:group={selected[qi]} value={oi} disabled={!!result} />
								{option}
								{#if result}
									{#if oi === result.graded[qi].correctIndex}
										<span style:color="var(--color-accent)"
											><span aria-hidden="true">✓</span><span class="sr-only" lang="es"
												>(correcta)</span
											></span
										>
									{:else if oi === result.graded[qi].selectedIndex}
										<span style:color="var(--color-danger)"
											><span aria-hidden="true">✗</span><span class="sr-only" lang="es"
												>(tu respuesta, incorrecta)</span
											></span
										>
									{/if}
								{/if}
							</label>
						{/each}
					</fieldset>
				{/each}

				{#if !result}
					<Button class="self-start" type="submit" disabled={!allAnswered || submitting}>
						{submitting ? 'Corrigiendo...' : 'Comprobar respuestas'}
					</Button>
				{/if}
			</form>

			{#if result}
				<div class="rounded-md border p-3 text-sm" style:border-color="var(--color-border)">
					<p>
						Puntuación: <strong style:color={scoreColor(result.score)}>{result.score}/100</strong>
					</p>
					<p class="mt-2" style:color="var(--color-ink-muted)">
						Transcripción: <span lang={exercise.language}>{exercise.passage}</span>
					</p>
				</div>
			{/if}
		{:else}
			<p class="text-sm" style:color="var(--color-ink-muted)">
				Pulsa "Nuevo ejercicio" para empezar.
			</p>
		{/if}
	</section>

	{#if data.recentAttempts.length > 0}
		<section
			class="rounded-lg border p-4"
			style:border-color="var(--color-border)"
			style:background-color="var(--color-surface)"
		>
			<h2 class="mb-3 text-sm font-medium">Últimos ejercicios</h2>
			<ul class="flex flex-col gap-2 text-sm">
				{#each data.recentAttempts as attempt (attempt.id)}
					<li class="flex items-center justify-between gap-3">
						<span style:color="var(--color-ink-muted)"
							>{new Date(attempt.createdAt).toLocaleString('es')}</span
						>
						<span style:color={scoreColor(attempt.score)}>{attempt.score}/100</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
