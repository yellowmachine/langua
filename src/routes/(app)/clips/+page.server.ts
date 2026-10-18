import { desc } from 'drizzle-orm';
import { clip } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const clips = await locals.withRLS((tx) =>
		tx
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
				transcriptionStatus: clip.transcriptionStatus,
				capturedAt: clip.capturedAt
			})
			.from(clip)
			.orderBy(desc(clip.capturedAt))
	);

	return { clips };
};
