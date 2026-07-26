import { error, json } from '@sveltejs/kit';
import { generateQuickReplies } from '$lib/server/ai/suggestions';
import { LANGUAGES } from '$lib/languages';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const { text, language, focus } = await event.request.json();

	if (typeof text !== 'string' || !text.trim()) error(400, 'No text to suggest replies for');
	if (typeof language !== 'string' || !LANGUAGES.some((lang) => lang.code === language)) {
		error(400, 'Invalid language');
	}

	const result = await generateQuickReplies(
		text,
		language,
		typeof focus === 'string' ? focus : null
	);
	return json(result);
};
