import { error, json } from '@sveltejs/kit';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { clipSourceName } from '$lib/clips';
import { extractVocabulary } from '$lib/server/ai/vocabulary';
import { clip, vocabItem } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

// Same as /chat/vocabulary, over a clip's transcript: on demand, never as
// part of the background transcription (it's an LLM call per clip).
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const source = await event.locals.withRLS(async (tx) => {
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
			.where(eq(clip.id, event.params.id));
		return found;
	});
	if (!source) error(404, 'Clip not found');
	if (!source.language) error(400, 'Clip language unknown');
	const language = source.language;
	if (source.cues.length === 0) return json({ added: 0, total: 0 });

	const { items } = await extractVocabulary(
		source.cues.map((cue) => cue.text).join('\n'),
		language,
		event.locals.user.nativeLanguage ?? 'English',
		'clip'
	);
	if (items.length === 0) return json({ added: 0, total: 0 });

	// Tagged like conversation words are with the conversation's title, so the
	// study book can filter by series/film.
	const tag = clipSourceName(source);
	const lemmas = items.map((item) => item.lemma.toLowerCase());

	const inserted = await event.locals.withRLS(async (tx) => {
		const rows = await tx
			.insert(vocabItem)
			.values(
				items.map((item) => ({
					id: crypto.randomUUID(),
					userId: event.locals.user!.id,
					targetLanguage: language,
					lemma: item.lemma.toLowerCase(),
					word: item.word,
					partOfSpeech: item.partOfSpeech,
					translation: item.translation,
					exampleSentence: item.exampleSentence,
					sourceClipId: event.params.id,
					tags: [tag]
				}))
			)
			.onConflictDoNothing({
				target: [vocabItem.userId, vocabItem.targetLanguage, vocabItem.lemma]
			})
			.returning({ id: vocabItem.id });

		// Words that already existed (skipped above) still get this clip's tag,
		// same as /chat/vocabulary does with the conversation's.
		await tx
			.update(vocabItem)
			.set({ tags: sql`${vocabItem.tags} || ${JSON.stringify([tag])}::jsonb` })
			.where(
				and(
					eq(vocabItem.userId, event.locals.user!.id),
					eq(vocabItem.targetLanguage, language),
					inArray(vocabItem.lemma, lemmas),
					sql`NOT (${vocabItem.tags} @> ${JSON.stringify([tag])}::jsonb)`
				)
			);

		return rows;
	});

	return json({ added: inserted.length, total: items.length });
};
