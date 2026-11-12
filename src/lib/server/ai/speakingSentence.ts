import { generateObject } from 'ai';
import { z } from 'zod';
import { getChatModel } from './chat';
import { englishNameForLanguage } from '$lib/languages';
import { levelInstruction } from '$lib/levels';

export const speakingSentenceSchema = z.object({
	sentence: z.string().describe('The sentence for the learner to say aloud'),
	translation: z.string().describe('Its translation into the learner’s native language')
});

export type SpeakingSentence = z.infer<typeof speakingSentenceSchema>;

/** A sentence to read aloud in Hablar, at the learner's level, optionally on a topic. */
export async function generateSpeakingSentence(
	userId: string,
	targetLanguage: string,
	nativeLanguage: string,
	level: string,
	topic?: string | null
): Promise<SpeakingSentence> {
	const model = await getChatModel(userId, 'speaking_sentence');
	const targetName = englishNameForLanguage(targetLanguage);
	const nativeName = englishNameForLanguage(nativeLanguage);

	const { object } = await generateObject({
		model,
		schema: speakingSentenceSchema,
		prompt: `You are a ${targetName} pronunciation tutor. Write one sentence in ${targetName} for the learner to say aloud, something a person would really say in everyday life, plus its translation into ${nativeName}.${
			topic
				? `\nThe learner asked for this topic (their own words, maybe in their native language): """${topic}"""`
				: ''
		}
Use only words, no numbers written as digits or abbreviations, so it can be compared with a transcription. ${levelInstruction(level)}`
	});

	return object;
}
