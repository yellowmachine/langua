import { error, json } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
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
			.select({ targetLanguage: chatConversation.targetLanguage })
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

	const inserted = await event.locals.withRLS((tx) =>
		tx
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
					sourceConversationId: conversationId
				}))
			)
			.onConflictDoNothing({
				target: [vocabItem.userId, vocabItem.targetLanguage, vocabItem.lemma]
			})
			.returning({ id: vocabItem.id })
	);

	return json({ added: inserted.length, total: items.length });
};
