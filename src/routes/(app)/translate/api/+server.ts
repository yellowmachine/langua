import { error, json } from '@sveltejs/kit';
import { translateMessage } from '$lib/server/ai/translateMessage';
import { LANGUAGES } from '$lib/languages';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const { text, fromLanguage, toLanguage } = await event.request.json();

	if (typeof text !== 'string' || !text.trim()) error(400, 'No text to translate');
	if (typeof fromLanguage !== 'string' || !LANGUAGES.some((lang) => lang.code === fromLanguage)) {
		error(400, 'Invalid source language');
	}
	if (typeof toLanguage !== 'string' || !LANGUAGES.some((lang) => lang.code === toLanguage)) {
		error(400, 'Invalid target language');
	}

	const { translation } = await translateMessage(text, fromLanguage, toLanguage);

	return json({ translation });
};
