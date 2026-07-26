import { generateObject } from 'ai';
import { z } from 'zod';
import { getChatModel } from './chat';
import { englishNameForLanguage } from '$lib/languages';

export const writingStyleAnalysisSchema = z.object({
	register: z
		.enum(['very_informal', 'informal', 'neutral', 'formal', 'very_formal'])
		.describe('Overall register/tone of the text'),
	registerNotes: z
		.string()
		.describe("One short sentence, in the reader's native language, on the tone/register"),
	naturalness: z
		.enum(['native_sounding', 'mostly_natural', 'somewhat_stilted', 'clearly_translated_sounding'])
		.describe(
			'How natural/native-sounding the phrasing is, independent of grammatical correctness'
		),
	naturalnessNotes: z
		.string()
		.describe(
			"One short sentence, in the reader's native language, on what makes it sound natural or stilted/translated"
		),
	cefrLevel: z
		.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
		.describe('Approximate CEFR level the vocabulary and grammatical structures correspond to'),
	cefrNotes: z
		.string()
		.describe(
			"One short sentence, in the reader's native language, briefly justifying the CEFR estimate"
		)
});

export type WritingStyleAnalysis = z.infer<typeof writingStyleAnalysisSchema>;

/** Holistic style read of a piece of text for the /correct tool — independent of grammar correctness or authorship (the text may be pasted, not the learner's own writing). */
export async function analyzeWritingStyle(
	text: string,
	targetLanguage: string,
	nativeLanguage: string
): Promise<WritingStyleAnalysis> {
	const model = await getChatModel();
	const targetName = englishNameForLanguage(targetLanguage);
	const nativeName = englishNameForLanguage(nativeLanguage);

	const { object } = await generateObject({
		model,
		schema: writingStyleAnalysisSchema,
		prompt: `Analyze the following ${targetName} text purely in terms of its style, independent of whether it contains grammatical mistakes. This text may or may not have been written by a language learner themselves — it could be pasted from elsewhere — so judge the text on its own merits, not the writer's ability.

"""
${text}
"""

Assess three things:
1. Register/tone: how formal or informal the text is.
2. Naturalness: does it read the way a native speaker would actually write, or does it sound stilted, overly literal, or translated from another language?
3. Approximate CEFR level (A1-C2): the level of vocabulary and grammatical complexity the text corresponds to.

For each, give a brief one-sentence note in ${nativeName} so the reader understands the judgment.`
	});

	return object;
}
