import { fail } from '@sveltejs/kit';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { generateSpeakingSentence } from '$lib/server/ai/speakingSentence';
import { speakingAttempt } from '$lib/server/db/schema';
import { LANGUAGES } from '$lib/languages';
import { LEVELS } from '$lib/levels';
import { compareSpeech } from '$lib/speechCompare';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const recentAttempts = await locals.withRLS((tx) =>
		tx
			.select({
				id: speakingAttempt.id,
				targetLanguage: speakingAttempt.targetLanguage,
				targetText: speakingAttempt.targetText,
				score: speakingAttempt.score,
				createdAt: speakingAttempt.createdAt
			})
			.from(speakingAttempt)
			.orderBy(desc(speakingAttempt.createdAt))
			.limit(5)
	);
	return { recentAttempts };
};

const language = z.string().refine((code) => LANGUAGES.some((lang) => lang.code === code));

const sentenceSchema = z.object({
	targetLanguage: language,
	level: z.string().refine((code) => LEVELS.some((level) => level.code === code)),
	topic: z.string().trim().max(200)
});

const attemptSchema = z.object({
	targetLanguage: language,
	sentence: z.string().trim().min(1).max(500),
	transcript: z.string().trim().max(1000)
});

export const actions: Actions = {
	sentence: async ({ request, locals }) => {
		const data = await request.formData();
		const parsed = sentenceSchema.safeParse({
			targetLanguage: data.get('targetLanguage'),
			level: data.get('level'),
			topic: data.get('topic') ?? ''
		});
		if (!parsed.success) return fail(400, { message: 'Elige idioma y nivel.' });
		const { targetLanguage, level, topic } = parsed.data;

		const sentence = await generateSpeakingSentence(
			locals.user!.id,
			targetLanguage,
			locals.user!.nativeLanguage ?? 'es',
			level,
			topic || null
		);
		return { ...sentence, targetLanguage };
	},

	// Scored here (not trusted from the page) and kept for Progreso.
	attempt: async ({ request, locals }) => {
		const data = await request.formData();
		const parsed = attemptSchema.safeParse({
			targetLanguage: data.get('targetLanguage'),
			sentence: data.get('sentence'),
			transcript: data.get('transcript')
		});
		if (!parsed.success) return fail(400, { message: 'Datos inválidos.' });
		const { targetLanguage, sentence, transcript } = parsed.data;

		const comparison = compareSpeech(sentence, transcript);
		await locals.withRLS((tx) =>
			tx.insert(speakingAttempt).values({
				id: crypto.randomUUID(),
				userId: locals.user!.id,
				targetLanguage,
				targetText: sentence,
				transcript,
				score: comparison.score
			})
		);
		return { transcript, ...comparison };
	}
};
