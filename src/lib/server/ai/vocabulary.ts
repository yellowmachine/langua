import { generateObject } from 'ai';
import { z } from 'zod';
import { getChatModel } from './chat';
import { englishNameForLanguage } from '$lib/languages';

export const vocabularyExtractionSchema = z.object({
	items: z.array(
		z.object({
			word: z.string().describe('Exact form as it appeared in the conversation'),
			lemma: z.string().describe('Dictionary/base form, lowercase'),
			partOfSpeech: z.enum(['noun', 'verb', 'adjective', 'adverb', 'other']),
			translation: z.string().describe('Translation into the native language'),
			exampleSentence: z
				.string()
				.describe('The sentence from the conversation where the word appears, verbatim')
		})
	)
});

export type VocabularyExtraction = z.infer<typeof vocabularyExtractionSchema>;

/** Extracts learner-relevant vocabulary (nouns, verbs, adjectives, adverbs) from a chat transcript. */
export async function extractVocabulary(
	transcript: string,
	targetLanguage: string,
	nativeLanguage: string
): Promise<VocabularyExtraction> {
	const model = await getChatModel();
	const targetName = englishNameForLanguage(targetLanguage);
	const nativeName = englishNameForLanguage(nativeLanguage);

	const { object } = await generateObject({
		model,
		schema: vocabularyExtractionSchema,
		prompt: `You are a ${targetName} language tutor building a vocabulary list from a conversation transcript between a student and an AI tutor.

Transcript:
"""
${transcript}
"""

Extract the nouns, verbs, adjectives, and adverbs in this transcript that are useful for a language learner to study. Skip trivial function words (articles, pronouns, common prepositions/conjunctions) and skip words that are identical in ${targetName} and ${nativeName}. Never report the same lemma twice.

For each word return: the exact form as it appeared, its dictionary/base form (lemma, lowercase), its part of speech, its translation into ${nativeName}, and the exact sentence from the transcript where it appears.

If there is nothing worth extracting, return an empty items array.`
	});

	return object;
}
