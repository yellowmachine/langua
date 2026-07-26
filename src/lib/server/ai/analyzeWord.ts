import { generateObject } from 'ai';
import { z } from 'zod';
import { getChatModel } from './chat';
import { englishNameForLanguage } from '$lib/languages';

export const wordAnalysisSchema = z.object({
	lemma: z.string().describe('Dictionary/base form of the word, lowercase'),
	partOfSpeech: z.enum(['noun', 'verb', 'adjective', 'adverb', 'other']),
	translation: z
		.string()
		.describe(
			'Translation into the native language of this specific word form as used in the sentence'
		),
	explanation: z
		.string()
		.describe(
			"Brief explanation, in the learner's native language, of what this word means and how it's being used in this specific sentence (e.g. disambiguating from other senses/conjugations)"
		)
});

export type WordAnalysis = z.infer<typeof wordAnalysisSchema>;

/** Analyzes a single word a learner clicked on in a chat message, for the /chat word-lookup panel. */
export async function analyzeWord(
	word: string,
	sentence: string,
	targetLanguage: string,
	nativeLanguage: string
): Promise<WordAnalysis> {
	const model = await getChatModel();
	const targetName = englishNameForLanguage(targetLanguage);
	const nativeName = englishNameForLanguage(nativeLanguage);

	const { object } = await generateObject({
		model,
		schema: wordAnalysisSchema,
		prompt: `A language learner clicked on the word "${word}" in this ${targetName} sentence:

"${sentence}"

Analyze that specific word as used in this sentence (not just any dictionary sense). Return its dictionary/base form (lemma, lowercase), its part of speech, its translation into ${nativeName} — matching the specific form/conjugation/meaning it has in this sentence — and a brief explanation in ${nativeName} of what it means and how it's functioning here.`
	});

	return object;
}
