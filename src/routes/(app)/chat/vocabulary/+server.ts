import { error, json } from '@sveltejs/kit';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { extractVocabulary } from '$lib/server/ai/vocabulary';
import { chatConversation, chatMessage, vocabItem } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const { conversationId } = await event.request.json();
	if (typeof conversationId !== 'string' || !conversationId) {
		error(400, 'Missing conversationId');
	}

	const [conversation, messages] = await event.locals.withRLS(async (tx) => {
		const [conv] = await tx
			.select({ targetLanguage: chatConversation.targetLanguage, title: chatConversation.title })
			.from(chatConversation)
			.where(eq(chatConversation.id, conversationId));

		const msgs = conv
			? await tx
					.select({ role: chatMessage.role, content: chatMessage.content })
					.from(chatMessage)
					.where(eq(chatMessage.conversationId, conversationId))
					.orderBy(asc(chatMessage.createdAt))
			: [];

		return [conv, msgs] as const;
	});

	if (!conversation?.targetLanguage) error(404, 'Conversation not found');
	if (messages.length === 0) return json({ added: 0, total: 0 });

	const transcript = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
	const { items } = await extractVocabulary(
		transcript,
		conversation.targetLanguage,
		event.locals.user.nativeLanguage ?? 'English'
	);

	if (items.length === 0) return json({ added: 0, total: 0 });

	const title = conversation.title;
	const lemmas = items.map((item) => item.lemma.toLowerCase());

	const inserted = await event.locals.withRLS(async (tx) => {
		const rows = await tx
			.insert(vocabItem)
			.values(
				items.map((item) => ({
					id: crypto.randomUUID(),
					userId: event.locals.user!.id,
					targetLanguage: conversation.targetLanguage!,
					lemma: item.lemma.toLowerCase(),
					word: item.word,
					partOfSpeech: item.partOfSpeech,
					translation: item.translation,
					exampleSentence: item.exampleSentence,
					sourceConversationId: conversationId,
					tags: title ? [title] : []
				}))
			)
			.onConflictDoNothing({
				target: [vocabItem.userId, vocabItem.targetLanguage, vocabItem.lemma]
			})
			.returning({ id: vocabItem.id });

		// Words that already existed (skipped above) still get this conversation's
		// topic tag, unless they already have it — newly-inserted rows already
		// carry it via `tags` above, so this only ever touches pre-existing rows.
		if (title) {
			await tx
				.update(vocabItem)
				.set({ tags: sql`${vocabItem.tags} || ${JSON.stringify([title])}::jsonb` })
				.where(
					and(
						eq(vocabItem.userId, event.locals.user!.id),
						eq(vocabItem.targetLanguage, conversation.targetLanguage!),
						inArray(vocabItem.lemma, lemmas),
						sql`NOT (${vocabItem.tags} @> ${JSON.stringify([title])}::jsonb)`
					)
				);
		}

		return rows;
	});

	return json({ added: inserted.length, total: items.length });
};
