import { fail, redirect } from '@sveltejs/kit';
import { desc } from 'drizzle-orm';
import { generateText } from 'ai';
import { getChatModel } from '$lib/server/ai/chat';
import { transcribeSpeech } from '$lib/server/ai/stt';
import { scorePronunciation } from '$lib/server/pronunciation';
import { englishNameForLanguage } from '$lib/languages';
import { speakingAttempt } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const recentAttempts = await locals.withRLS((tx) =>
		tx
			.select({
				id: speakingAttempt.id,
				prompt: speakingAttempt.prompt,
				transcript: speakingAttempt.transcript,
				score: speakingAttempt.score,
				createdAt: speakingAttempt.createdAt
			})
			.from(speakingAttempt)
			.orderBy(desc(speakingAttempt.createdAt))
			.limit(10)
	);

	return { recentAttempts };
};

export const actions: Actions = {
	newPrompt: async ({ locals }) => {
		if (!locals.user) redirect(303, '/login');

		const languageName = englishNameForLanguage(locals.user.targetLanguage);
		const model = await getChatModel();
		const { text } = await generateText({
			model,
			prompt: `Write exactly one short, natural sentence (6-10 words) in ${languageName} for a beginner-intermediate learner to read aloud and practice pronunciation. Respond with only the sentence — no quotes, no extra text.`
		});

		return { prompt: text.trim() };
	},

	attempt: async (event) => {
		if (!event.locals.user) redirect(303, '/login');

		const data = await event.request.formData();
		const prompt = String(data.get('prompt') ?? '').trim();
		const audio = data.get('audio');

		if (!prompt || !(audio instanceof File)) {
			return fail(400, { message: 'Falta la grabación.' });
		}

		const targetLanguage = event.locals.user.targetLanguage;
		const transcript = await transcribeSpeech(audio, targetLanguage);
		const score = scorePronunciation(prompt, transcript);

		await event.locals.withRLS((tx) =>
			tx.insert(speakingAttempt).values({
				id: crypto.randomUUID(),
				userId: event.locals.user!.id,
				targetLanguage: targetLanguage ?? 'en',
				prompt,
				transcript,
				score
			})
		);

		return { transcript, score };
	}
};
