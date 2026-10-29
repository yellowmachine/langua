import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { SEILIDE_PROVIDER_ID } from '$lib/server/auth-options';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, '/dashboard');

	// better-auth sends the browser back here with ?error=… when the sign-in
	// with Seilide fails (cancelled, rejected, misconfigured client…).
	return { failed: url.searchParams.has('error') };
};

export const actions: Actions = {
	default: async (event) => {
		const { url } = await auth.api.signInWithOAuth2({
			body: {
				providerId: SEILIDE_PROVIDER_ID,
				callbackURL: '/dashboard',
				errorCallbackURL: '/login'
			},
			headers: event.request.headers
		});

		redirect(303, url);
	}
};
