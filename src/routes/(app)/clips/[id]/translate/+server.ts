import { error, json } from '@sveltejs/kit';
import { translateMessage } from '$lib/server/ai/translateMessage';
import { loadClipCue } from '$lib/server/clip-cue';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const { cueIndex } = await event.request.json();
	const { language, text } = await loadClipCue(event.locals.withRLS, event.params.id, cueIndex);

	const { translation } = await translateMessage(
		event.locals.user.id,
		text,
		language,
		event.locals.user.nativeLanguage ?? 'English'
	);

	return json({ translation });
};
