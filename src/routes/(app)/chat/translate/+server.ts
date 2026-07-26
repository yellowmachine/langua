import { error, json } from '@sveltejs/kit';
import { translateMessage } from '$lib/server/ai/translateMessage';
import { chatMessage } from '$lib/server/db/schema';
import { LANGUAGES } from '$lib/languages';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const { messageId, conversationId, text, language } = await event.request.json();

	if (typeof messageId !== 'string' || !messageId) error(400, 'Missing messageId');
	if (typeof conversationId !== 'string' || !conversationId) error(400, 'Missing conversationId');
	if (typeof text !== 'string' || !text.trim()) error(400, 'No text to translate');
	if (typeof language !== 'string' || !LANGUAGES.some((lang) => lang.code === language)) {
		error(400, 'Invalid language');
	}

	const { translation } = await translateMessage(
		text,
		language,
		event.locals.user.nativeLanguage ?? 'English'
	);

	// The assistant message row may not exist yet (this call can race with
	// /chat/api's own onEnd insert of the same message), so upsert on the
	// shared id rather than assuming the row is already there.
	await event.locals.withRLS((tx) =>
		tx
			.insert(chatMessage)
			.values({ id: messageId, conversationId, role: 'assistant', content: text, translation })
			.onConflictDoUpdate({ target: chatMessage.id, set: { translation } })
	);

	return json({ translation });
};
