import { error, json } from '@sveltejs/kit';
import { analyzeUserMessage } from '$lib/server/ai/analysis';
import { LANGUAGES } from '$lib/languages';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const { text, language } = await event.request.json();

	if (typeof text !== 'string' || !text.trim()) error(400, 'No text to analyze');
	if (typeof language !== 'string' || !LANGUAGES.some((lang) => lang.code === language)) {
		error(400, 'Invalid language');
	}

	const analysis = await analyzeUserMessage(text, language);
	return json(analysis);
};
