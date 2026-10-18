import { error, json } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import { analyzeWord, wordAnalysisSchema } from '$lib/server/ai/analyzeWord';
import { clipSourceName } from '$lib/clips';
import { loadClipCue } from '$lib/server/clip-cue';
import { vocabItem } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const PARTS_OF_SPEECH = wordAnalysisSchema.shape.partOfSpeech.options;

// Same as /chat/word, for a word in one of a clip's phrases.
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const { cueIndex, word } = await event.request.json();
	if (typeof word !== 'string' || !word.trim()) error(400, 'Missing word');

	const { language, text } = await loadClipCue(event.locals.withRLS, event.params.id, cueIndex);

	const analysis = await analyzeWord(
		word,
		text,
		language,
		event.locals.user.nativeLanguage ?? 'English'
	);

	return json(analysis);
};

export const PUT: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');

	const { cueIndex, word, lemma, partOfSpeech, translation } = await event.request.json();

	if (typeof word !== 'string' || !word.trim()) error(400, 'Missing word');
	if (typeof lemma !== 'string' || !lemma.trim()) error(400, 'Missing lemma');
	if (typeof translation !== 'string' || !translation.trim()) error(400, 'Missing translation');
	const validPartOfSpeech = PARTS_OF_SPEECH.find((p) => p === partOfSpeech);
	if (!validPartOfSpeech) error(400, 'Invalid partOfSpeech');

	const {
		clip: source,
		language,
		text
	} = await loadClipCue(event.locals.withRLS, event.params.id, cueIndex);

	const normalizedLemma = lemma.toLowerCase();
	// Tagged like conversation words are with the conversation's title, so the
	// study book can filter by series/film.
	const tag = clipSourceName(source);

	const added = await event.locals.withRLS(async (tx) => {
		const rows = await tx
			.insert(vocabItem)
			.values({
				id: crypto.randomUUID(),
				userId: event.locals.user!.id,
				targetLanguage: language,
				lemma: normalizedLemma,
				word,
				partOfSpeech: validPartOfSpeech,
				translation,
				exampleSentence: text,
				sourceClipId: event.params.id,
				tags: [tag]
			})
			.onConflictDoNothing({
				target: [vocabItem.userId, vocabItem.targetLanguage, vocabItem.lemma]
			})
			.returning({ id: vocabItem.id });

		// Same word already existed (skipped above) — still tag it with this
		// clip's source if it doesn't have it yet, same as /chat/word.
		await tx
			.update(vocabItem)
			.set({ tags: sql`${vocabItem.tags} || ${JSON.stringify([tag])}::jsonb` })
			.where(
				and(
					eq(vocabItem.userId, event.locals.user!.id),
					eq(vocabItem.targetLanguage, language),
					eq(vocabItem.lemma, normalizedLemma),
					sql`NOT (${vocabItem.tags} @> ${JSON.stringify([tag])}::jsonb)`
				)
			);

		return rows.length > 0;
	});

	return json({ added });
};
