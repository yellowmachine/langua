import { generateObject } from 'ai';
import { z } from 'zod';
import { getChatModel } from './chat';
import { englishNameForLanguage } from '$lib/languages';

export const writingCorrectionSchema = z.object({
	corrections: z.array(
		z.object({
			original: z.string().describe('The exact original excerpt with the mistake'),
			correction: z.string().describe('The corrected version of that excerpt'),
			explanation: z
				.string()
				.describe("Brief explanation of the mistake, in the learner's native language")
		})
	),
	overallFeedback: z
		.string()
		.nullable()
		.describe(
			'Short overall feedback in the native language, or null if the text is essentially correct'
		)
});

export type WritingCorrection = z.infer<typeof writingCorrectionSchema>;

/** Reviews a piece of free-form writing for the standalone /correct tool (no chat context). */
export async function correctWriting(
	text: string,
	targetLanguage: string,
	nativeLanguage: string
): Promise<WritingCorrection> {
	const model = await getChatModel();
	const targetName = englishNameForLanguage(targetLanguage);
	const nativeName = englishNameForLanguage(nativeLanguage);

	const { object } = await generateObject({
		model,
		schema: writingCorrectionSchema,
		prompt: `You are a ${targetName} writing tutor. Review the following text written by a learner in ${targetName}:

"""
${text}
"""

Find every relevant mistake (grammar, spelling, word choice, awkward phrasing). For each one, return the exact original excerpt (verbatim, must appear in the text unchanged), the corrected version of that excerpt, and a brief explanation of the mistake written in ${nativeName} so the learner clearly understands it.

Then write a short overall feedback comment in ${nativeName} — encouraging if the text is good, or a brief summary of the main issues. If there are no mistakes at all, return an empty corrections array and a short positive overallFeedback.`
	});

	return object;
}
