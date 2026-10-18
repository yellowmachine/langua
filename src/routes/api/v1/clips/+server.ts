import { json } from '@sveltejs/kit';
import { authenticateBearer } from '$lib/server/api-auth';
import { enqueueClipTranscription } from '$lib/server/clip-transcription';
import {
	looksLikeMp4,
	MAX_CLIP_AUDIO_BYTES,
	parseClipMetadata,
	planClipTranscript
} from '$lib/server/clips';
import { clip } from '$lib/server/db/schema';
import { clipStorage } from '$lib/server/storage';
import type { RequestHandler } from './$types';

// JellyCartoon → Langua: a stretch of an episode/film's audio plus its
// subtitles. Error messages are read out loud to the user by JellyCartoon.
export const POST: RequestHandler = async ({ request, url }) => {
	const { userId, withRLS } = await authenticateBearer(request);

	let form: FormData;
	try {
		form = await request.formData();
	} catch (err) {
		// Past BODY_SIZE_LIMIT, adapter-node fails the body read with a 413.
		if ((err as { status?: number }).status === 413) return tooLarge();
		return unprocessable('La petición no trae un formulario válido.');
	}

	const audio = form.get('audio');
	if (!(audio instanceof File) || audio.size === 0) return unprocessable('Falta el audio.');
	if (audio.size > MAX_CLIP_AUDIO_BYTES) return tooLarge();
	if (!(await looksLikeMp4(audio))) return unprocessable('El audio no es un fichero M4A.');

	const parsed = parseClipMetadata(form.get('metadata'));
	if (!parsed.ok) return unprocessable(parsed.message);
	const { metadata } = parsed;
	const plan = planClipTranscript(metadata);

	const id = crypto.randomUUID();
	const audioKey = `${id}.m4a`;

	// File first, then the row: a row is never visible without its audio.
	await clipStorage.put(audioKey, audio);
	try {
		await withRLS((tx) =>
			tx.insert(clip).values({
				id,
				userId,
				source: metadata.source,
				kind: metadata.kind,
				title: metadata.title,
				series: metadata.series ?? null,
				season: metadata.season ?? null,
				episode: metadata.episode ?? null,
				year: metadata.year ?? null,
				startSec: metadata.startSec,
				endSec: metadata.endSec,
				language: plan.language,
				transcript: plan.transcript,
				cues: plan.cues,
				transcriptionStatus: plan.needsTranscription ? 'pending' : 'ready',
				audioKey,
				audioSize: audio.size,
				audioType: 'audio/mp4',
				capturedAt: metadata.capturedAt ? new Date(metadata.capturedAt) : new Date()
			})
		);
	} catch (err) {
		await clipStorage.delete(audioKey);
		throw err;
	}

	// Answered before it's done: the clip shows «transcribiendo…» meanwhile.
	if (plan.needsTranscription) enqueueClipTranscription(id, withRLS);

	return json({ id, url: `${url.origin}/clips/${id}` }, { status: 201 });
};

function tooLarge() {
	return json({ message: 'El audio es demasiado grande.' }, { status: 413 });
}

function unprocessable(message: string) {
	return json({ message }, { status: 422 });
}
