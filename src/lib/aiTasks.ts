/** What each AI call was for, as it is logged (ai_usage.task) and shown in Gasto en IA. */
export const AI_TASKS = {
	chat: 'Respuestas del tutor',
	chat_opening: 'Saludo de una conversación',
	message_analysis: 'Revisión de tus mensajes',
	suggestions: 'Sugerencias de respuesta',
	translation: 'Traducciones',
	word: 'Análisis de palabras',
	vocabulary: 'Extracción de vocabulario',
	example_sentence: 'Frases de ejemplo',
	correction: 'Corregir textos',
	writing_style: 'Análisis de estilo',
	listening: 'Ejercicios de escucha',
	speaking_sentence: 'Frases para repetir',
	speech: 'Voz (lectura en voz alta)'
} as const;

export type AiTask = keyof typeof AI_TASKS;

export function aiTaskLabel(task: string): string {
	return AI_TASKS[task as AiTask] ?? task;
}
