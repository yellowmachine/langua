// What the user can choose about the speech they hear (Mi cuenta → Voz),
// shared by the client (pickers, /tts URLs) and the server (instructions).

/** Gemini's voices, as Seilide offers them; all speak every language. */
export const VOICES = [
	{ id: 'Kore', label: 'Kore (mujer, firme)' },
	{ id: 'Leda', label: 'Leda (mujer, juvenil)' },
	{ id: 'Aoede', label: 'Aoede (mujer, ligera)' },
	{ id: 'Puck', label: 'Puck (hombre, animado)' },
	{ id: 'Charon', label: 'Charon (hombre, informativo)' },
	{ id: 'Fenrir', label: 'Fenrir (hombre, con energía)' }
] as const;

export type VoiceId = (typeof VOICES)[number]['id'];

export const DEFAULT_VOICE: VoiceId = 'Kore';

export function isVoice(value: unknown): value is VoiceId {
	return VOICES.some((v) => v.id === value);
}

/**
 * Accents per language in src/lib/languages.ts, the default first.
 * `description` is what the model is told, in English.
 */
export const ACCENTS: Record<
	string,
	readonly { code: string; label: string; description: string }[]
> = {
	es: [
		{
			code: 'es-ES',
			label: 'España',
			description: 'Spanish from Spain (Castilian, peninsular accent)'
		},
		{ code: 'es-MX', label: 'México', description: 'Mexican Spanish' },
		{ code: 'es-AR', label: 'Argentina', description: 'Rioplatense Spanish from Buenos Aires' }
	],
	en: [
		{ code: 'en-US', label: 'Estados Unidos', description: 'General American English' },
		{
			code: 'en-GB',
			label: 'Reino Unido',
			description: 'British English (standard southern accent)'
		},
		{ code: 'en-AU', label: 'Australia', description: 'Australian English' }
	],
	fr: [
		{
			code: 'fr-FR',
			label: 'Francia',
			description: 'Standard French from France (Parisian accent)'
		},
		{ code: 'fr-CA', label: 'Canadá', description: 'Quebec French' }
	],
	de: [
		{ code: 'de-DE', label: 'Alemania', description: 'Standard German from Germany' },
		{ code: 'de-AT', label: 'Austria', description: 'Austrian German' }
	],
	it: [{ code: 'it-IT', label: 'Italia', description: 'Standard Italian' }],
	pt: [
		{ code: 'pt-BR', label: 'Brasil', description: 'Brazilian Portuguese' },
		{ code: 'pt-PT', label: 'Portugal', description: 'European Portuguese from Portugal' }
	]
};

/** `accent` if it is one of `language`'s, else that language's default (if any). */
export function accentFor(language?: string | null, accent?: string | null) {
	const options = (language && ACCENTS[language]) || [];
	return options.find((a) => a.code === accent) ?? options[0] ?? null;
}

/**
 * How the text is said, by where it is heard: a chat reply, a listening
 * passage, or a word on its own (word panel, vocabulary).
 */
export const SPEECH_STYLES = ['conversation', 'narration', 'word'] as const;

export type SpeechStyle = (typeof SPEECH_STYLES)[number];

export function isSpeechStyle(value: unknown): value is SpeechStyle {
	return SPEECH_STYLES.includes(value as SpeechStyle);
}

/** What Mi cuenta → Voz plays to try the chosen voice and accent. */
export const VOICE_SAMPLES: Record<string, string> = {
	es: 'Hola, ¿qué tal? Hoy vamos a practicar un poco juntos.',
	en: "Hi there! Today we're going to practise a little together.",
	fr: "Bonjour ! Aujourd'hui, on va pratiquer un peu ensemble.",
	de: 'Hallo! Heute üben wir ein bisschen zusammen.',
	it: 'Ciao! Oggi facciamo un po’ di pratica insieme.',
	pt: 'Olá! Hoje vamos praticar um pouco juntos.'
};
