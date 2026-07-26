import { error, json } from '@sveltejs/kit';
import { correctWriting } from '$lib/server/ai/correctWriting';
import { LANGUAGES } from '$lib/languages';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const { text, targetLanguage } = await event.request.json();

	if (typeof text !== 'string' || !text.trim()) error(400, 'No text to check');
	if (
		typeof targetLanguage !== 'string' ||
		!LANGUAGES.some((lang) => lang.code === targetLanguage)
	) {
		error(400, 'Invalid language');
	}

	const result = await correctWriting(
		text,
		targetLanguage,
		event.locals.user.nativeLanguage ?? 'English'
	);

	return json(result);
};
