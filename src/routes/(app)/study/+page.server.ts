import { fail } from '@sveltejs/kit';
import { count, desc, eq, lte } from 'drizzle-orm';
import { vocabItem } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

const MAX_FIELD_LENGTH = 300;

export const load: PageServerLoad = async ({ locals }) => {
	const [items, [{ due }]] = await Promise.all([
		locals.withRLS((tx) =>
			tx
				.select({
					id: vocabItem.id,
					targetLanguage: vocabItem.targetLanguage,
					word: vocabItem.word,
					partOfSpeech: vocabItem.partOfSpeech,
					translation: vocabItem.translation,
					exampleSentence: vocabItem.exampleSentence,
					extraExamples: vocabItem.extraExamples,
					tags: vocabItem.tags,
					createdAt: vocabItem.createdAt
				})
				.from(vocabItem)
				.orderBy(desc(vocabItem.createdAt))
		),
		locals.withRLS((tx) =>
			tx.select({ due: count() }).from(vocabItem).where(lte(vocabItem.dueAt, new Date()))
		)
	]);

	return { items, due };
};

function field(data: FormData, name: string) {
	return String(data.get(name) ?? '').trim();
}

export const actions: Actions = {
	edit: async ({ request, locals }) => {
		const data = await request.formData();
		const id = field(data, 'id');
		const word = field(data, 'word');
		const translation = field(data, 'translation');
		const exampleSentence = field(data, 'exampleSentence');

		if (!id || !word || !translation) {
			return fail(400, { id, message: 'La palabra y la traducción no pueden quedar vacías.' });
		}
		if ([word, translation, exampleSentence].some((v) => v.length > MAX_FIELD_LENGTH)) {
			return fail(400, { id, message: `Máximo ${MAX_FIELD_LENGTH} caracteres por campo.` });
		}

		await locals.withRLS((tx) =>
			tx.update(vocabItem).set({ word, translation, exampleSentence }).where(eq(vocabItem.id, id))
		);
		return { id, saved: true };
	},

	delete: async ({ request, locals }) => {
		const data = await request.formData();
		const id = field(data, 'id');
		if (!id) return fail(400, { id, message: 'Falta la palabra.' });

		await locals.withRLS((tx) => tx.delete(vocabItem).where(eq(vocabItem.id, id)));
		return { id, deleted: true };
	}
};
