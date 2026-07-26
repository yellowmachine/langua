import { error, json } from '@sveltejs/kit';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { analyzeWord, wordAnalysisSchema } from '$lib/server/ai/analyzeWord';
import { chatConversation, vocabItem } from '$lib/server/db/schema';
import { LANGUAGES } from '$lib/languages';
import type { RequestHandler } from './$types';

const PARTS_OF_SPEECH = wordAnalysisSchema.shape.partOfSpeech.options;

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const { word, sentence, targetLanguage } = await event.request.json();

	if (typeof word !== 'string' || !word.trim()) error(400, 'Missing word');
	if (typeof sentence !== 'string' || !sentence.trim()) error(400, 'Missing sentence');
	if (
		typeof targetLanguage !== 'string' ||
		!LANGUAGES.some((lang) => lang.code === targetLanguage)
	) {
		error(400, 'Invalid language');
	}

	const analysis = await analyzeWord(
		word,
		sentence,
		targetLanguage,
		event.locals.user.nativeLanguage ?? 'English'
	);

	return json(analysis);
};

export const PUT: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const { conversationId, word, lemma, partOfSpeech, translation, exampleSentence } =
		await event.request.json();

	if (typeof conversationId !== 'string' || !conversationId) error(400, 'Missing conversationId');
	if (typeof word !== 'string' || !word.trim()) error(400, 'Missing word');
	if (typeof lemma !== 'string' || !lemma.trim()) error(400, 'Missing lemma');
	if (typeof translation !== 'string' || !translation.trim()) error(400, 'Missing translation');
	if (typeof exampleSentence !== 'string' || !exampleSentence.trim()) {
		error(400, 'Missing exampleSentence');
	}
	const validPartOfSpeech = PARTS_OF_SPEECH.find((p) => p === partOfSpeech);
	if (!validPartOfSpeech) error(400, 'Invalid partOfSpeech');

	const conversation = await event.locals.withRLS(async (tx) => {
		const [row] = await tx
			.select({ targetLanguage: chatConversation.targetLanguage, title: chatConversation.title })
			.from(chatConversation)
			.where(eq(chatConversation.id, conversationId));
		return row;
	});
	if (!conversation?.targetLanguage) error(404, 'Conversation not found');

	const normalizedLemma = lemma.toLowerCase();
	const title = conversation.title;

	const added = await event.locals.withRLS(async (tx) => {
		const rows = await tx
			.insert(vocabItem)
			.values({
				id: crypto.randomUUID(),
				userId: event.locals.user!.id,
				targetLanguage: conversation.targetLanguage!,
				lemma: normalizedLemma,
				word,
				partOfSpeech: validPartOfSpeech,
				translation,
				exampleSentence,
				sourceConversationId: conversationId,
				tags: title ? [title] : []
			})
			.onConflictDoNothing({
				target: [vocabItem.userId, vocabItem.targetLanguage, vocabItem.lemma]
			})
			.returning({ id: vocabItem.id });

		// Same word already existed (skipped above) — still tag it with this
		// conversation's topic if it doesn't have it yet, same as /chat/vocabulary.
		if (title) {
			await tx
				.update(vocabItem)
				.set({ tags: sql`${vocabItem.tags} || ${JSON.stringify([title])}::jsonb` })
				.where(
					and(
						eq(vocabItem.userId, event.locals.user!.id),
						eq(vocabItem.targetLanguage, conversation.targetLanguage!),
						inArray(vocabItem.lemma, [normalizedLemma]),
						sql`NOT (${vocabItem.tags} @> ${JSON.stringify([title])}::jsonb)`
					)
				);
		}

		return rows.length > 0;
	});

	return json({ added });
};
