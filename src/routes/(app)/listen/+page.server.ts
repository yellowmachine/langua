import { fail, redirect } from '@sveltejs/kit';
import { desc } from 'drizzle-orm';
import { generateListeningExercise } from '$lib/server/ai/listening';
import { listeningAttempt, type ListeningQuestionResult } from '$lib/server/db/schema';
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

		return await generateListeningExercise(targetLanguage, level, exerciseType || undefined);
	},

	submit: async (event) => {
		if (!event.locals.user) redirect(303, '/login');

		const data = await event.request.formData();
		const passage = String(data.get('passage') ?? '');
		const targetLanguage =
			String(data.get('targetLanguage') ?? '') || event.locals.user.targetLanguage;

		let questions: Array<{ question: string; options: string[]; correctIndex: number }>;
		let answers: number[];
		try {
			questions = JSON.parse(String(data.get('questions') ?? '[]'));
			answers = JSON.parse(String(data.get('answers') ?? '[]'));
		} catch {
			return fail(400, { message: 'Datos inválidos.' });
		}

		if (!passage || questions.length === 0 || answers.length !== questions.length) {
			return fail(400, { message: 'Datos inválidos.' });
		}

		const graded: ListeningQuestionResult[] = questions.map((q, i) => ({
			...q,
			selectedIndex: answers[i]
		}));
		const correctCount = graded.filter((q) => q.selectedIndex === q.correctIndex).length;
		const score = Math.round((correctCount / questions.length) * 100);

		await event.locals.withRLS((tx) =>
			tx.insert(listeningAttempt).values({
				id: crypto.randomUUID(),
				userId: event.locals.user!.id,
				targetLanguage: targetLanguage ?? 'en',
				passage,
				questions: graded,
				score
			})
		);

		return { graded, score };
	}
};
