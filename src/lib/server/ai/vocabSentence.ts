import { generateObject } from 'ai';
import { z } from 'zod';
import { getChatModel } from './chat';
import { englishNameForLanguage } from '$lib/languages';

export const exampleSentenceSchema = z.object({
	sentence: z.string().describe('A natural example sentence using the word')
});

export type ExampleSentence = z.infer<typeof exampleSentenceSchema>;

/** Generates a fresh example sentence for a vocabulary word, for the /study page. */
export async function generateExampleSentence(
	word: string,
	partOfSpeech: string,
	targetLanguage: string,
	existingSentences: string[]
): Promise<ExampleSentence> {
	const model = await getChatModel();
	const languageName = englishNameForLanguage(targetLanguage);

	const { object } = await generateObject({
		model,
		schema: exampleSentenceSchema,
		prompt: `You are a ${languageName} language tutor helping a student study vocabulary.

Write one natural, simple example sentence in ${languageName} that uses the word "${word}" (${partOfSpeech}).

${
	existingSentences.length > 0
		? `Do not repeat any of these sentences the student has already seen for this word:\n${existingSentences.map((s) => `- ${s}`).join('\n')}`
		: ''
}`
	});

	return object;
}
