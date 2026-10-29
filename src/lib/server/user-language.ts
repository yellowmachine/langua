import { error } from '@sveltejs/kit';

/**
 * The language translations and explanations are written in. The (app)
 * layout sends anyone without one to Mi cuenta first, so this only stops
 * a request from a page opened before that; better than guessing English.
 */
export function requireNativeLanguage(user: { nativeLanguage?: string | null }): string {
	if (!user.nativeLanguage) error(400, 'Elige tu idioma nativo en Mi cuenta.');
	return user.nativeLanguage;
}
