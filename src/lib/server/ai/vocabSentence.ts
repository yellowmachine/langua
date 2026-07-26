import { generateObject } from 'ai';
import { z } from 'zod';
import { getChatModel } from './chat';
import { englishNameForLanguage } from '$lib/languages';

export const exampleSentenceSchema = z.object({
	sentence: z.string().describe('A natural example sentence using the word'),
	translation: z.string().describe('Translation of that sentence into the native language')
});

export type ExampleSentence = z.infer<typeof exampleSentenceSchema>;

/** Generates a fresh example sentence (with translation) for a vocabulary word, for the /study page. */
export async function generateExampleSentence(
	word: string,
	partOfSpeech: string,
	targetLanguage: string,
	nativeLanguage: string,
	existingSentences: string[]
): Promise<ExampleSentence> {
	const model = await getChatModel();
	const targetName = englishNameForLanguage(targetLanguage);
	const nativeName = englishNameForLanguage(nativeLanguage);

	const { object } = await generateObject({
		model,
		schema: exampleSentenceSchema,
		prompt: `You are a ${targetName} language tutor helping a student study vocabulary.

Write one natural, simple example sentence in ${targetName} that uses the word "${word}" (${partOfSpeech}), plus its translation into ${nativeName}.

${
	existingSentences.length > 0
		? `Do not repeat any of these sentences the student has already seen for this word:\n${existingSentences.map((s) => `- ${s}`).join('\n')}`
		: ''
}`
	});

	return object;
}
