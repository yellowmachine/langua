import { error } from '@sveltejs/kit';
import { synthesizeSpeech } from '$lib/server/ai/tts';
import { isSpeechStyle, isVoice } from '$lib/voices';
import type { RequestHandler } from './$types';

const MAX_TEXT_LENGTH = 2000;

// Voice and accent come in the URL, not from the user's row, so that the
// browser's year-long cache of each URL never serves an old voice after the
// user changes it in Mi cuenta.
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const params = event.url.searchParams;
	const text = params.get('text');
	if (!text) error(400, 'text is required');

	const voice = params.get('voice');
	const style = params.get('style');

	const audio = await synthesizeSpeech(event.locals.user.id, text.slice(0, MAX_TEXT_LENGTH), {
		language: params.get('language'),
		voice: isVoice(voice) ? voice : null,
		accent: params.get('accent'),
		style: isSpeechStyle(style) ? style : 'conversation',
		slow: params.get('slow') === '1'
	});

	return new Response(new Blob([new Uint8Array(audio)]), {
		headers: {
			'Content-Type': 'audio/wav',
			'Cache-Control': 'private, max-age=31536000, immutable'
		}
	});
};
