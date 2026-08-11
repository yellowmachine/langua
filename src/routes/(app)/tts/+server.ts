import { error } from '@sveltejs/kit';
import { synthesizeSpeech } from '$lib/server/ai/tts';
import type { RequestHandler } from './$types';

const MAX_TEXT_LENGTH = 2000;

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const text = event.url.searchParams.get('text');
	const language = event.url.searchParams.get('language');
	if (!text) error(400, 'text is required');

	const audio = await synthesizeSpeech(text.slice(0, MAX_TEXT_LENGTH), language);

	return new Response(new Blob([new Uint8Array(audio)]), {
		headers: {
			'Content-Type': 'audio/wav',
			'Cache-Control': 'private, max-age=31536000, immutable'
		}
	});
};
