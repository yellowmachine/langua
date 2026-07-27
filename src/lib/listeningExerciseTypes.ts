/** Curated listening exercise styles. `description` feeds the AI prompt; `code`/`label` drive the UI. */
export const LISTENING_EXERCISE_TYPES: { code: string; label: string; description: string }[] = [
	{
		code: 'dialogue',
		label: 'Diálogo cotidiano',
		description: 'a short spoken exchange between two people having an everyday conversation'
	},
	{
		code: 'announcement',
		label: 'Anuncio por megafonía',
		description:
			'a public announcement one might hear over a loudspeaker, e.g. at a train station, airport, or shop'
	},
	{
		code: 'phone_call',
		label: 'Llamada telefónica',
		description: 'a phone conversation or a voicemail message'
	},
	{
		code: 'news',
		label: 'Noticia breve',
		description: 'a short radio or news-style report on an everyday topic'
	},
	{
		code: 'instructions',
		label: 'Instrucciones',
		description: 'someone giving step-by-step instructions or directions'
	}
];
