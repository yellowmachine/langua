import { error, json } from '@sveltejs/kit';
import { transcribeSpeech } from '$lib/server/ai/stt';
import { LANGUAGES } from '$lib/languages';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const form = await event.request.formData();
	const audio = form.get('audio');
	if (!(audio instanceof File)) error(400, 'audio is required');

	// The recorder sends the language it is dictating in (a conversation's or
	// the one picked in /speak); the account's target language is only the
	// fallback, otherwise whisper is forced into the wrong language.
	const requested = form.get('language');
	const language = LANGUAGES.some((lang) => lang.code === requested)
		? (requested as string)
		: event.locals.user.targetLanguage;

	try {
		return json({ text: await transcribeSpeech(audio, language) });
	} catch (cause) {
		console.error('[transcribe]', cause);
		error(502, 'No se pudo transcribir la grabación. Inténtalo otra vez.');
	}
};
