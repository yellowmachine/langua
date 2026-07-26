import { error, json } from '@sveltejs/kit';
import { transcribeSpeech } from '$lib/server/ai/stt';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const form = await event.request.formData();
	const audio = form.get('audio');
	if (!(audio instanceof File)) error(400, 'audio is required');

	const text = await transcribeSpeech(audio, event.locals.user.targetLanguage);

	return json({ text });
};
