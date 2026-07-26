import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { getChatModel } from '$lib/server/ai/chat';
import { chatConversation, chatMessage } from '$lib/server/db/schema';
import { englishNameForLanguage } from '$lib/languages';
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

	await event.locals.withRLS(async (tx) => {
		const [conversation] = await tx
			.select({ id: chatConversation.id, targetLanguage: chatConversation.targetLanguage })
			.from(chatConversation)
			.where(eq(chatConversation.id, id));
		if (!conversation) error(404, 'Conversation not found');

		await tx.insert(chatMessage).values({
			id: crypto.randomUUID(),
			conversationId: id,
			role: 'user',
			content: textFromMessage(lastMessage)
		});
	});

	const model = await getChatModel();
	const targetLanguage = event.locals.user.targetLanguage;
	const languageName = englishNameForLanguage(targetLanguage);

	const result = streamText({
		model,
		system: `You are a friendly, patient conversation partner helping the user practice ${languageName}. Keep replies short (2-4 sentences), stay in ${languageName} unless the user switches language, and gently correct significant mistakes.`,
		messages: await convertToModelMessages(messages)
	});

	return result.toUIMessageStreamResponse({
		originalMessages: messages,
		onEnd: async ({ responseMessage }) => {
			await event.locals.withRLS(async (tx) => {
				await tx.insert(chatMessage).values({
					id: crypto.randomUUID(),
					conversationId: id,
					role: 'assistant',
					content: textFromMessage(responseMessage)
				});
			});
		}
	});
};
