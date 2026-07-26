import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	if (!building) {
		const result = await auth.api.getSession({ headers: event.request.headers });
		event.locals.session = result?.session ?? null;
		event.locals.user = result?.user ?? null;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};
