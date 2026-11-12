import { error } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { convertToModelMessages, generateId, streamText, type UIMessage } from 'ai';
import { z } from 'zod';
import { getChatModel } from '$lib/server/ai/chat';
import { buildChatSystemPrompt } from '$lib/server/ai/chatSystemPrompt';
import { chatConversation, chatMessage } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

/** Longest message a learner can send; longer ones are refused. */
const MAX_MESSAGE_LENGTH = 2000;
/** How much of the conversation the model sees (and the family pays for). */
const HISTORY_LIMIT = 40;

// Only the conversation id and the learner's newest message are taken from
// the request. The history comes from the database, so the browser can't
// slip in made-up system or assistant turns, or an endless history.
const requestSchema = z.object({
	id: z.string().min(1),
	messages: z
		.array(z.object({ id: z.string(), role: z.string(), parts: z.array(z.unknown()) }))
		.min(1)
});
const learnerMessageSchema = z.object({
	id: z.string().min(1).max(100),
	role: z.literal('user'),
	parts: z.array(z.object({ type: z.string(), text: z.string().optional() }))
});

function textFromMessage(message: Pick<UIMessage, 'parts'>): string {
	return message.parts
		.filter((part) => part.type === 'text')
		.map((part) => ('text' in part ? part.text : ''))
		.join('');
}

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const body = requestSchema.safeParse(await event.request.json().catch(() => null));
	if (!body.success) error(400, 'Petición inválida');
	const { id } = body.data;

	const last = learnerMessageSchema.safeParse(body.data.messages.at(-1));
	if (!last.success) error(400, 'El último mensaje tiene que ser tuyo');
	const learnerText = textFromMessage(last.data as Pick<UIMessage, 'parts'>).trim();
	if (!learnerText) error(400, 'El mensaje está vacío');
	if (learnerText.length > MAX_MESSAGE_LENGTH) {
		error(400, `El mensaje es demasiado largo (máximo ${MAX_MESSAGE_LENGTH} caracteres)`);
	}

	const { conversation, history } = await event.locals.withRLS(async (tx) => {
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

		// Already there when the reply is being retried.
		await tx
			.insert(chatMessage)
			.values({ id: last.data.id, conversationId: id, role: 'user', content: learnerText })
			.onConflictDoNothing({ target: chatMessage.id });

		const rows = await tx
			.select({ id: chatMessage.id, role: chatMessage.role, content: chatMessage.content })
			.from(chatMessage)
			.where(eq(chatMessage.conversationId, id))
			.orderBy(asc(chatMessage.createdAt));

		// A retry after a failed reply ends on the learner's message; drop any
		// reply that came after it so the model answers that message again.
		const end = rows.findIndex((r) => r.id === last.data.id);
		const upTo = end === -1 ? rows : rows.slice(0, end + 1);

		return { conversation: row, history: upTo.slice(-HISTORY_LIMIT) };
	});

	const messages: UIMessage[] = history.map((row) => ({
		id: row.id,
		role: row.role,
		parts: [{ type: 'text', text: row.content }]
	}));

	const model = await getChatModel(event.locals.user.id);
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
					// /chat/translate may have upserted this row with the text as it
					// was mid-stream; the finished text must win.
					.onConflictDoUpdate({
						target: chatMessage.id,
						set: { content: textFromMessage(responseMessage) }
					});
			});
		}
	});
};
