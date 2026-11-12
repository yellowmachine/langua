import { fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, lt } from 'drizzle-orm';
import { z } from 'zod';
import { generateListeningExercise } from '$lib/server/ai/listening';
import {
	listeningAttempt,
	listeningExercise,
	type ListeningQuestionResult
} from '$lib/server/db/schema';
import { LANGUAGES } from '$lib/languages';
import { LEVELS } from '$lib/levels';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const recentAttempts = await locals.withRLS((tx) =>
		tx
			.select({
				id: listeningAttempt.id,
				score: listeningAttempt.score,
				createdAt: listeningAttempt.createdAt
			})
			.from(listeningAttempt)
			.orderBy(desc(listeningAttempt.createdAt))
			.limit(10)
	);

	return { recentAttempts };
};

export const actions: Actions = {
	newExercise: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/login');

		const data = await request.formData();
		const targetLanguage = String(data.get('targetLanguage') ?? '');
		const level = String(data.get('level') ?? '');
		const exerciseType = String(data.get('exerciseType') ?? '').trim();

		if (!LANGUAGES.some((lang) => lang.code === targetLanguage)) {
			return fail(400, { message: 'Idioma inválido.' });
		}
		if (!LEVELS.some((lvl) => lvl.code === level)) {
			return fail(400, { message: 'Nivel inválido.' });
		}

		const exercise = await generateListeningExercise(
			locals.user.id,
			targetLanguage,
			level,
			exerciseType || undefined
		);

		// The answers stay on the server until the learner has answered.
		// Exercises left unanswered for a day are dropped on the way.
		const id = crypto.randomUUID();
		const yesterday = new Date(Date.now() - 24 * 3600_000);
		await locals.withRLS(async (tx) => {
			await tx
				.delete(listeningExercise)
				.where(
					and(
						eq(listeningExercise.userId, locals.user!.id),
						lt(listeningExercise.createdAt, yesterday)
					)
				);
			await tx.insert(listeningExercise).values({
				id,
				userId: locals.user!.id,
				targetLanguage,
				passage: exercise.passage,
				questions: exercise.questions
			});
		});

		return {
			exerciseId: id,
			passage: exercise.passage,
			questions: exercise.questions.map(({ question, options }) => ({ question, options }))
		};
	},

	submit: async (event) => {
		if (!event.locals.user) redirect(303, '/login');

		const data = await event.request.formData();
		const parsed = submitSchema.safeParse({
			exerciseId: data.get('exerciseId'),
			answers: parseJson(data.get('answers'))
		});
		if (!parsed.success) return fail(400, { message: 'Datos inválidos.' });
		const { exerciseId, answers } = parsed.data;

		const outcome = await event.locals.withRLS(async (tx) => {
			const [exercise] = await tx
				.select()
				.from(listeningExercise)
				.where(eq(listeningExercise.id, exerciseId));
			if (!exercise) return null;
			if (answers.length !== exercise.questions.length) return 'mismatch' as const;

			const graded: ListeningQuestionResult[] = exercise.questions.map((q, i) => ({
				...q,
				selectedIndex: answers[i]
			}));
			const correctCount = graded.filter((q) => q.selectedIndex === q.correctIndex).length;
			const score = Math.round((correctCount / graded.length) * 100);

			await tx.insert(listeningAttempt).values({
				id: crypto.randomUUID(),
				userId: event.locals.user!.id,
				targetLanguage: exercise.targetLanguage,
				passage: exercise.passage,
				questions: graded,
				score
			});
			await tx.delete(listeningExercise).where(eq(listeningExercise.id, exerciseId));

			return { graded, score };
		});

		if (outcome === null) {
			return fail(404, { message: 'Este ejercicio ya está corregido o no existe.' });
		}
		if (outcome === 'mismatch') return fail(400, { message: 'Datos inválidos.' });
		return outcome;
	}
};

const submitSchema = z.object({
	exerciseId: z.string().min(1),
	answers: z.array(z.number().int().min(0).max(2)).max(10)
});

function parseJson(value: FormDataEntryValue | null): unknown {
	try {
		return JSON.parse(String(value ?? ''));
	} catch {
		return null;
	}
}
