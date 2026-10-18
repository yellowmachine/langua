import { error, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '$lib/server/auth';
import { withUserRLS } from '$lib/server/db/rls';

const handleSession: Handle = async ({ event, resolve }) => {
	if (!building) {
		const result = await auth.api.getSession({ headers: event.request.headers });
		event.locals.session = result?.session ?? null;
		event.locals.user = result?.user ?? null;
	}

	return resolve(event);
};

// Any query for per-user content (chat, progress, etc.) should go through
// `locals.withRLS` instead of the plain `db` import — see withUserRLS.
const handleRLS: Handle = ({ event, resolve }) => {
	const userId = event.locals.user?.id;

	event.locals.withRLS = (fn) => {
		if (!userId) error(401, 'Unauthorized');
		return withUserRLS(userId, fn);
	};

	return resolve(event);
};

const handleBetterAuth: Handle = ({ event, resolve }) => {
	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handleSession, handleRLS, handleBetterAuth);
