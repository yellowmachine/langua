import { generateObject } from 'ai';
import { z } from 'zod';
import { getChatModel } from './chat';
import { englishNameForLanguage } from '$lib/languages';
import { levelInstruction } from '$lib/levels';

export const listeningQuestionSchema = z.object({
	question: z.string(),
	options: z.array(z.string()).length(3),
	correctIndex: z.number().int().min(0).max(2)
});

export const listeningExerciseSchema = z.object({
	passage: z.string(),
	questions: z.array(listeningQuestionSchema).length(3)
});

export type ListeningExercise = z.infer<typeof listeningExerciseSchema>;

/** Audio for the passage is generated on demand by the existing /tts endpoint. */
export async function generateListeningExercise(
	targetLanguage?: string | null,
	level?: string | null,
	exerciseType?: string | null
): Promise<ListeningExercise> {
	const languageName = englishNameForLanguage(targetLanguage);
	const model = await getChatModel();

	const typeInstruction = exerciseType
		? ` The learner asked for this kind of passage (their own words, possibly in their native language): "${exerciseType}".`
		: '';

	const { object } = await generateObject({
		model,
		schema: listeningExerciseSchema,
		prompt: `Write a short listening comprehension exercise in ${languageName}: a natural 2-4 sentence passage (something one might plausibly hear in daily life), followed by exactly 3 multiple-choice comprehension questions about it.${typeInstruction} Each question must have exactly 3 options in ${languageName}, with exactly one correct. Keep the passage and all questions/options in ${languageName}. ${levelInstruction(level ?? null)}`
	});

	return object;
}
