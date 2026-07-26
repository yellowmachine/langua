import { error, json } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { generateExampleSentence } from '$lib/server/ai/vocabSentence';
import { vocabItem } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const [item] = await event.locals.withRLS((tx) =>
		tx
			.select({
				word: vocabItem.word,
				partOfSpeech: vocabItem.partOfSpeech,
				targetLanguage: vocabItem.targetLanguage,
				exampleSentence: vocabItem.exampleSentence,
				extraExamples: vocabItem.extraExamples
			})
			.from(vocabItem)
			.where(eq(vocabItem.id, event.params.id))
	);
	if (!item) error(404, 'Vocabulary item not found');

	const { sentence } = await generateExampleSentence(
		item.word,
		item.partOfSpeech,
		item.targetLanguage,
		[item.exampleSentence, ...item.extraExamples]
	);

	return json({ sentence });
};

export const PUT: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const { sentence } = await event.request.json();
	if (typeof sentence !== 'string' || !sentence.trim()) error(400, 'Missing sentence');

	const updated = await event.locals.withRLS((tx) =>
		tx
			.update(vocabItem)
			.set({
				extraExamples: sql`${vocabItem.extraExamples} || ${JSON.stringify([sentence])}::jsonb`
			})
			.where(eq(vocabItem.id, event.params.id))
			.returning({ id: vocabItem.id })
	);
	if (updated.length === 0) error(404, 'Vocabulary item not found');

	return json({ ok: true });
};
