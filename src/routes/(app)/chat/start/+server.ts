import { error, json } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { generateText } from 'ai';
import { getChatModel } from '$lib/server/ai/chat';
import { buildChatSystemPrompt } from '$lib/server/ai/chatSystemPrompt';
import { chatConversation, chatMessage } from '$lib/server/db/schema';
import { englishNameForLanguage } from '$lib/languages';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const { conversationId } = await event.request.json();
	if (typeof conversationId !== 'string' || !conversationId) error(400, 'Missing conversationId');

	const conversation = await event.locals.withRLS(async (tx) => {
		const [row] = await tx
			.select({ targetLanguage: chatConversation.targetLanguage, title: chatConversation.title })
			.from(chatConversation)
			.where(eq(chatConversation.id, conversationId));
		return row;
	});
	if (!conversation) error(404, 'Conversation not found');

	const [{ count }] = await event.locals.withRLS((tx) =>
		tx
			.select({ count: sql<number>`count(*)::int` })
			.from(chatMessage)
			.where(eq(chatMessage.conversationId, conversationId))
	);
	// Already has messages (a real reply, or another call already opened it) — no-op.
	if (count > 0) return json({ started: false });

	const model = await getChatModel();
	const system = buildChatSystemPrompt(conversation.targetLanguage, conversation.title);
	const languageName = englishNameForLanguage(conversation.targetLanguage);

	const { text } = await generateText({
		model,
		system,
		prompt: `Write a short, friendly opening message in ${languageName} to start this conversation with the learner${
			conversation.title ? ` about: "${conversation.title}"` : ''
		}. Greet them and ask an inviting question to get them talking. Keep it short (1-3 sentences).`
	});

	await event.locals.withRLS((tx) =>
		tx.insert(chatMessage).values({
			id: crypto.randomUUID(),
			conversationId,
			role: 'assistant',
			content: text
		})
	);

	return json({ started: true });
};
