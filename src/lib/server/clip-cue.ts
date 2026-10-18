import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { clip } from './db/schema';
import type { WithRLS } from './db/rls';

/**
 * One phrase of one of the user's clips, for the translate/word endpoints
 * under /clips/[id]. The text always comes from the database, never from
 * the request. 404 if the clip isn't theirs, 400 if it has no language
 * Langua can work with.
 */
export async function loadClipCue(withRLS: WithRLS, clipId: string, cueIndex: unknown) {
	if (typeof cueIndex !== 'number' || !Number.isInteger(cueIndex) || cueIndex < 0) {
		error(400, 'Invalid cueIndex');
	}

	const row = await withRLS(async (tx) => {
		const [found] = await tx
			.select({
				language: clip.language,
				cues: clip.cues,
				kind: clip.kind,
				title: clip.title,
				series: clip.series,
				season: clip.season,
				episode: clip.episode,
				year: clip.year
			})
			.from(clip)
			.where(eq(clip.id, clipId));
		return found;
	});
	if (!row) error(404, 'Clip not found');

	const cue = row.cues[cueIndex];
	if (!cue) error(400, 'Invalid cueIndex');
	if (!row.language) error(400, 'Clip language unknown');

	return { clip: row, language: row.language, text: cue.text };
}
