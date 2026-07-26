import { generateObject } from 'ai';
import { z } from 'zod';
import { getChatModel } from './chat';
import { englishNameForLanguage } from '$lib/languages';

export const messageAnalysisSchema = z.object({
	errors: z.array(
		z.object({
			fragment: z
				.string()
				.describe('Exact substring from the message that contains the mistake, verbatim.'),
			type: z.enum(['spelling', 'grammar'])
		})
	),
	explanation: z
		.string()
		.nullable()
		.describe('Short friendly explanation of the mistakes, or null if there are none.')
});

export type MessageAnalysis = z.infer<typeof messageAnalysisSchema>;

/** Reviews a learner's message for spelling/grammar mistakes, for inline highlighting in chat. */
export async function analyzeUserMessage(
	text: string,
	targetLanguage: string
): Promise<MessageAnalysis> {
	const model = await getChatModel();
	const languageName = englishNameForLanguage(targetLanguage);

	const { object } = await generateObject({
		model,
		schema: messageAnalysisSchema,
		prompt: `You are a ${languageName} language tutor reviewing a student's message for mistakes.

Student's message: "${text}"

Find spelling and grammar mistakes in the message. For each mistake, return the exact substring from the message that contains it (verbatim, must appear in the message unchanged, keep it short — a word or short phrase) and whether it is a "spelling" or "grammar" issue. Never report the same fragment twice.

Then write a short (1-2 sentence) friendly explanation of the mistakes, in ${languageName}, aimed at helping the student understand what to fix. If there are no mistakes, return an empty errors array and explanation: null.`
	});

	return object;
}
