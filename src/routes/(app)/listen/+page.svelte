<script lang="ts">
	import { enhance } from '$app/forms';
	import SpeakButton from '$lib/components/SpeakButton.svelte';
	import { LANGUAGES } from '$lib/languages';
	import { LEVELS } from '$lib/levels';
	import { LISTENING_EXERCISE_TYPES } from '$lib/listeningExerciseTypes';
	import type { PageData } from './$types';

	type Question = { question: string; options: string[]; correctIndex: number };
	type GradedQuestion = Question & { selectedIndex: number };

	let { data }: { data: PageData } = $props();

	let targetLanguage = $state(data.user.targetLanguage ?? LANGUAGES[0].code);
	let level = $state<(typeof LEVELS)[number]['code']>('beginner');
	let exerciseType = $state('');

	let exercise = $state<{ passage: string; questions: Question[]; language: string } | null>(null);
	let selected = $state<number[]>([]);
	let generating = $state(false);
	let submitting = $state(false);
	let result = $state<{ graded: GradedQuestion[]; score: number } | null>(null);

	function scoreColor(score: number) {
		if (score >= 85) return 'var(--color-accent)';
		if (score >= 60) return 'var(--color-ink)';
		return '#dc2626';
	}

	let allAnswered = $derived(
		exercise !== null &&
			selected.length === exercise.questions.length &&
			selected.every((s) => s >= 0)
	);
</script>

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
				return async ({ result: actionResult }) => {
					generating = false;
					if (actionResult.type === 'success' && actionResult.data) {
						exercise = {
							...(actionResult.data as { passage: string; questions: Question[] }),
							language: targetLanguage
						};
						selected = exercise.questions.map(() => -1);
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
					class="rounded-md border px-3 py-2"
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
					class="rounded-md border px-3 py-2"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-background)"
				>
					{#each LEVELS as lvl (lvl.code)}
						<option value={lvl.code}>{lvl.label}</option>
					{/each}
				</select>
			</label>

			<button
				type="submit"
				disabled={generating || submitting}
				class="rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
				style:background-color="var(--color-accent)"
			>
				{generating ? 'Generando...' : exercise ? 'Otro ejercicio' : 'Nuevo ejercicio'}
			</button>

			<div class="flex w-full flex-wrap gap-1.5">
				{#each LISTENING_EXERCISE_TYPES as type (type.label)}
					<button
						type="button"
						onclick={() => (exerciseType = type.prompt)}
						class="rounded-full border border-dashed px-2.5 py-1 text-xs"
						style:border-color="var(--color-accent)"
						style:color="var(--color-accent)"
					>
						{type.label}
					</button>
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

		{#if exercise}
			<div class="flex items-center gap-2">
				<SpeakButton text={exercise.passage} language={exercise.language} />
				<span class="text-sm" style:color="var(--color-ink-muted)">Escucha el audio</span>
			</div>

			<form
				method="POST"
				action="?/submit"
				use:enhance={() => {
					submitting = true;
					return async ({ result: actionResult }) => {
						submitting = false;
						if (actionResult.type === 'success' && actionResult.data) {
							result = actionResult.data as { graded: GradedQuestion[]; score: number };
						}
					};
				}}
				class="flex flex-col gap-4"
			>
				<input type="hidden" name="passage" value={exercise.passage} />
				<input type="hidden" name="questions" value={JSON.stringify(exercise.questions)} />
				<input type="hidden" name="answers" value={JSON.stringify(selected)} />
				<input type="hidden" name="targetLanguage" value={exercise.language} />

				{#each exercise.questions as question, qi (qi)}
					<fieldset class="flex flex-col gap-1.5">
						<legend class="text-sm font-medium">{question.question}</legend>
						{#each question.options as option, oi (oi)}
							<label class="flex items-center gap-2 text-sm">
								<input type="radio" bind:group={selected[qi]} value={oi} disabled={!!result} />
								{option}
								{#if result}
									{#if oi === result.graded[qi].correctIndex}
										<span style:color="var(--color-accent)">✓</span>
									{:else if oi === result.graded[qi].selectedIndex}
										<span style:color="#dc2626">✗</span>
									{/if}
								{/if}
							</label>
						{/each}
					</fieldset>
				{/each}

				{#if !result}
					<button
						type="submit"
						disabled={!allAnswered || submitting}
						class="self-start rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
						style:background-color="var(--color-accent)"
					>
						{submitting ? 'Corrigiendo...' : 'Comprobar respuestas'}
					</button>
				{/if}
			</form>

			{#if result}
				<div class="rounded-md border p-3 text-sm" style:border-color="var(--color-border)">
					<p>
						Puntuación: <strong style:color={scoreColor(result.score)}>{result.score}/100</strong>
					</p>
					<p class="mt-2" style:color="var(--color-ink-muted)">Transcripción: {exercise.passage}</p>
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
