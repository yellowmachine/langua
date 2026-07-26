import { generateObject } from 'ai';
import { z } from 'zod';
import { getChatModel } from './chat';
import { englishNameForLanguage } from '$lib/languages';

export const messageTranslationSchema = z.object({
	translation: z.string().describe('Natural translation of the message into the target language')
});

export type MessageTranslation = z.infer<typeof messageTranslationSchema>;

/**
 * Translates a chat message on demand, in either direction: the tutor's reply
 * into the learner's native language (the collapsible "Traducir" button under
 * each assistant message), or a draft the learner typed in their native
 * language into the conversation's target language (the "Traducir" button
 * next to "Enviar", before sending).
 */
export async function translateMessage(
	text: string,
	fromLanguage: string,
	toLanguage: string
): Promise<MessageTranslation> {
	const model = await getChatModel();
	const fromName = englishNameForLanguage(fromLanguage);
	const toName = englishNameForLanguage(toLanguage);

	const { object } = await generateObject({
		model,
		schema: messageTranslationSchema,
		prompt: `Translate the following ${fromName} text into natural, everyday ${toName}. Keep the tone and meaning, don't add any commentary — just the translation.

Text: "${text}"`
	});

	return object;
}
