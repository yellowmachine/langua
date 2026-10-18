import type { auth } from '$lib/server/auth';
import type { WithRLS } from '$lib/server/db/rls';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: typeof auth.$Infer.Session.session | null;
			user: typeof auth.$Infer.Session.user | null;
			/**
			 * Runs `fn` inside a transaction scoped to the current user via
			 * Postgres RLS (`app.current_user_id`). Use for any query against
			 * per-user content tables. Throws 401 if there's no session.
			 */
			withRLS: WithRLS;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
