export const LANGUAGES = [
	{ code: 'es', label: 'Español', englishName: 'Spanish' },
	{ code: 'en', label: 'Inglés', englishName: 'English' },
	{ code: 'fr', label: 'Francés', englishName: 'French' },
	{ code: 'de', label: 'Alemán', englishName: 'German' },
	{ code: 'it', label: 'Italiano', englishName: 'Italian' },
	{ code: 'pt', label: 'Portugués', englishName: 'Portuguese' }
] as const;

/** English name of the language, for prompting AI models regardless of UI language. */
export function englishNameForLanguage(code?: string | null): string {
	return LANGUAGES.find((lang) => lang.code === code)?.englishName ?? 'English';
}
