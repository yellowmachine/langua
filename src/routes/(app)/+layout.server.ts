import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.user) redirect(303, '/login');

	// A new account (created on the first sign-in with Seilide) has no
	// languages yet, and translations, explanations and the chat all need
	// them: ask for them in Mi cuenta before anything else.
	const missingLanguages = !locals.user.nativeLanguage || !locals.user.targetLanguage;
	if (missingLanguages && url.pathname !== '/account') redirect(303, '/account');

	return { user: locals.user };
};
