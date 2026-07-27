import { englishNameForLanguage } from '$lib/languages';
import { levelInstruction } from '$lib/levels';

/** System prompt shared by /chat/api (ongoing replies) and /chat/start (opening message). */
export function buildChatSystemPrompt(
	targetLanguage: string | null,
	title: string | null,
	level: string | null
): string {
	const languageName = englishNameForLanguage(targetLanguage);

	const base = title
		? `You are a friendly, patient conversation partner helping the user practice ${languageName}. Keep replies short (2-4 sentences), stay in ${languageName} unless the user switches language, and gently correct significant mistakes. The learner set this focus for the conversation (their own words, possibly in their native language): "${title}". Steer the conversation towards that focus.`
		: `You are a friendly, patient conversation partner helping the user practice ${languageName}. Keep replies short (2-4 sentences), stay in ${languageName} unless the user switches language, and gently correct significant mistakes.`;

	// The model would sometimes invent a name for itself in a greeting (e.g.
	// "mi chiamo Laura") and then, a few turns later, confuse that name with
	// the learner's and address them by it instead.
	return `${base} You don't have a name of your own — don't invent one for yourself in introductions or greetings. Never address the learner by a name unless they have explicitly told you their own name in the conversation. ${levelInstruction(level)}`;
}
