import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { listeningAttempt } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const [attempt] = await locals.withRLS((tx) =>
		tx
			.select({
				targetLanguage: listeningAttempt.targetLanguage,
				passage: listeningAttempt.passage,
				questions: listeningAttempt.questions,
				score: listeningAttempt.score,
				createdAt: listeningAttempt.createdAt
			})
			.from(listeningAttempt)
			.where(eq(listeningAttempt.id, params.id))
	);
	if (!attempt) error(404, 'Ejercicio no encontrado');
	return { attempt };
};
