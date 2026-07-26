import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { convertToModelMessages, generateId, streamText, type UIMessage } from 'ai';
import { getChatModel } from '$lib/server/ai/chat';
import { buildChatSystemPrompt } from '$lib/server/ai/chatSystemPrompt';
import { chatConversation, chatMessage } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

function textFromMessage(message: UIMessage): string {
	return message.parts
		.filter((part) => part.type === 'text')
		.map((part) => part.text)
		.join('');
}

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const { id, messages }: { id: string; messages: UIMessage[] } = await event.request.json();
	const lastMessage = messages.at(-1);
	if (!lastMessage) error(400, 'No message to send');

	const conversation = await event.locals.withRLS(async (tx) => {
		const [row] = await tx
			.select({
				id: chatConversation.id,
				targetLanguage: chatConversation.targetLanguage,
				title: chatConversation.title,
				level: chatConversation.level
			})
			.from(chatConversation)
			.where(eq(chatConversation.id, id));
		if (!row) error(404, 'Conversation not found');

		await tx
			.insert(chatMessage)
			.values({
				id: lastMessage.id,
				conversationId: id,
				role: 'user',
				content: textFromMessage(lastMessage)
			})
			.onConflictDoNothing({ target: chatMessage.id });

		return row;
	});

	const model = await getChatModel();
	const system = buildChatSystemPrompt(
		conversation.targetLanguage,
		conversation.title,
		conversation.level
	);

	const result = streamText({
		model,
		system,
		messages: await convertToModelMessages(messages)
	});

	return result.toUIMessageStreamResponse({
		originalMessages: messages,
		// Without this, the SDK never assigns the response message a real id:
		// the server would persist it with an empty id while the client mints
		// its own separate one, so anything trying to persist by messageId
		// (like the translation feature) would silently create a duplicate row.
		generateMessageId: generateId,
		onEnd: async ({ responseMessage }) => {
			await event.locals.withRLS(async (tx) => {
				await tx
					.insert(chatMessage)
					.values({
						id: responseMessage.id,
						conversationId: id,
						role: 'assistant',
						content: textFromMessage(responseMessage)
					})
					.onConflictDoNothing({ target: chatMessage.id });
			});
		}
	});
};
