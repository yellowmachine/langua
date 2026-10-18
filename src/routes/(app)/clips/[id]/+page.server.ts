import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import {
	enqueueClipTranscription,
	isClipTranscriptionQueued
} from '$lib/server/clip-transcription';
import { clip } from '$lib/server/db/schema';
import { clipStorage } from '$lib/server/storage';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const row = await locals.withRLS(async (tx) => {
		const [found] = await tx
			.select({
				id: clip.id,
				kind: clip.kind,
				title: clip.title,
				series: clip.series,
				season: clip.season,
				episode: clip.episode,
				year: clip.year,
				startSec: clip.startSec,
				endSec: clip.endSec,
				language: clip.language,
				cues: clip.cues,
				translationLanguage: clip.translationLanguage,
				translationCues: clip.translationCues,
				transcriptionStatus: clip.transcriptionStatus,
				capturedAt: clip.capturedAt
			})
			.from(clip)
			.where(eq(clip.id, params.id));
		return found;
	});
	if (!row) error(404, 'Clip no encontrado');

	return {
		clip: row,
		// 'pending' but not in this process's queue = the job was lost to a
		// restart, so the page offers a retry instead of waiting forever.
		transcriptionQueued: isClipTranscriptionQueued(row.id)
	};
};

export const actions: Actions = {
	retranscribe: async ({ params, locals }) => {
		const updated = await locals.withRLS((tx) =>
			tx
				.update(clip)
				.set({ transcriptionStatus: 'pending' })
				.where(eq(clip.id, params.id))
				.returning({ id: clip.id })
		);
		if (updated.length === 0) error(404, 'Clip no encontrado');

		enqueueClipTranscription(params.id, locals.withRLS);
	},

	delete: async ({ params, locals }) => {
		const [deleted] = await locals.withRLS((tx) =>
			tx.delete(clip).where(eq(clip.id, params.id)).returning({ audioKey: clip.audioKey })
		);
		if (!deleted) error(404, 'Clip no encontrado');

		// After the row: if this fails we're left with an orphaned file, never
		// with a clip whose audio is gone.
		await clipStorage.delete(deleted.audioKey);

		redirect(303, '/clips');
	}
};
