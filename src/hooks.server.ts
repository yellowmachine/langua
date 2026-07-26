import { error, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { sql } from 'drizzle-orm';
import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';

const handleSession: Handle = async ({ event, resolve }) => {
	if (!building) {
		const result = await auth.api.getSession({ headers: event.request.headers });
		event.locals.session = result?.session ?? null;
		event.locals.user = result?.user ?? null;
	}

	return resolve(event);
};

// Row-Level Security: any query for per-user content (chat, progress, etc.)
// should go through `locals.withRLS` instead of the plain `db` import. It
// runs inside a transaction with `app.current_user_id` set for that
// transaction only, which the table's RLS policies key off of. This only
// has teeth because the app connects as a non-superuser, non-owner role
// (see scripts/init.sh) — RLS is bypassed for superusers/owners.
const handleRLS: Handle = ({ event, resolve }) => {
	const userId = event.locals.user?.id;

	event.locals.withRLS = (fn) => {
		if (!userId) error(401, 'Unauthorized');

		return db.transaction(async (tx) => {
			await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
			return fn(tx);
		});
	};

	return resolve(event);
};

const handleBetterAuth: Handle = ({ event, resolve }) => {
	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handleSession, handleRLS, handleBetterAuth);
