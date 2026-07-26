import { desc } from 'drizzle-orm';
import { vocabItem } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const items = await locals.withRLS((tx) =>
		tx
			.select({
				id: vocabItem.id,
				targetLanguage: vocabItem.targetLanguage,
				word: vocabItem.word,
				partOfSpeech: vocabItem.partOfSpeech,
				translation: vocabItem.translation,
				exampleSentence: vocabItem.exampleSentence,
				extraExamples: vocabItem.extraExamples,
				tags: vocabItem.tags,
				createdAt: vocabItem.createdAt
			})
			.from(vocabItem)
			.orderBy(desc(vocabItem.createdAt))
	);

	return { items };
};
