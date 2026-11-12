import { fail } from '@sveltejs/kit';
import { and, asc, count, eq, lte } from 'drizzle-orm';
import { vocabItem, vocabReview } from '$lib/server/db/schema';
import { isRating, preview, review } from '$lib/server/srs';
import type { Actions, PageServerLoad } from './$types';

/** Cards handed out per session; more come on the next visit. */
const SESSION_SIZE = 30;

export const load: PageServerLoad = async ({ locals }) => {
	const now = new Date();
	const [cards, [{ due }]] = await Promise.all([
		locals.withRLS((tx) =>
			tx
				.select({
					id: vocabItem.id,
					targetLanguage: vocabItem.targetLanguage,
					word: vocabItem.word,
					partOfSpeech: vocabItem.partOfSpeech,
					translation: vocabItem.translation,
					exampleSentence: vocabItem.exampleSentence,
					srs: vocabItem.srs
				})
				.from(vocabItem)
				.where(lte(vocabItem.dueAt, now))
				.orderBy(asc(vocabItem.dueAt))
				.limit(SESSION_SIZE)
		),
		locals.withRLS((tx) =>
			tx.select({ due: count() }).from(vocabItem).where(lte(vocabItem.dueAt, now))
		)
	]);

	return {
		due,
		cards: cards.map(({ srs, ...card }) => ({
			...card,
			isNew: srs === null,
			// When each answer would bring it back, shown on the buttons.
			nextDue: Object.fromEntries(
				Object.entries(preview(srs, now)).map(([rating, date]) => [rating, date.toISOString()])
			) as Record<'1' | '2' | '3' | '4', string>
		}))
	};
};

export const actions: Actions = {
	grade: async ({ request, locals }) => {
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		const rating = Number(data.get('rating'));
		if (!id || !isRating(rating)) return fail(400, { message: 'Respuesta inválida.' });

		const result = await locals.withRLS(async (tx) => {
			const [item] = await tx
				.select({ srs: vocabItem.srs })
				.from(vocabItem)
				.where(eq(vocabItem.id, id))
				.for('update');
			if (!item) return null;

			const now = new Date();
			const next = review(item.srs, rating, now);
			await tx
				.update(vocabItem)
				.set({ srs: next.srs, dueAt: next.dueAt })
				.where(and(eq(vocabItem.id, id)));
			await tx.insert(vocabReview).values({
				id: crypto.randomUUID(),
				userId: locals.user!.id,
				vocabItemId: id,
				rating,
				reviewedAt: now
			});
			return { dueAt: next.dueAt.toISOString(), nextDue: preview(next.srs, next.dueAt) };
		});

		if (!result) return fail(404, { message: 'Esa palabra ya no está en tu libro.' });
		return {
			id,
			dueAt: result.dueAt,
			nextDue: Object.fromEntries(
				Object.entries(result.nextDue).map(([r, d]) => [r, d.toISOString()])
			) as Record<'1' | '2' | '3' | '4', string>
		};
	}
};
