import { generateObject } from 'ai';
import { z } from 'zod';
import { getChatModel } from './chat';
import { englishNameForLanguage } from '$lib/languages';

export const quickRepliesSchema = z.object({
	suggestions: z.array(z.string()).length(2)
});

export type QuickReplies = z.infer<typeof quickRepliesSchema>;

/** Two short example replies a beginner could send next, for the chat's "modo iniciático". */
export async function generateQuickReplies(
	assistantText: string,
	targetLanguage: string,
	focus?: string | null
): Promise<QuickReplies> {
	const model = await getChatModel();
	const languageName = englishNameForLanguage(targetLanguage);

	const { object } = await generateObject({
		model,
		schema: quickRepliesSchema,
		prompt: `You are helping a true beginner practice ${languageName} in a conversation${focus ? ` focused on: "${focus}"` : ''}.

The tutor just said: "${assistantText}"

Suggest exactly 2 short, natural example replies in ${languageName} that the student could send next. Keep each one brief (a short sentence or phrase), using simple vocabulary and grammar suitable for a true beginner. They should be distinct, plausible things a student might actually want to say next.`
	});

	return object;
}
