import { sql } from 'drizzle-orm';
import { db, type Tx } from '.';

// Row-Level Security: runs `fn` inside a transaction with
// `app.current_user_id` set for that transaction only, which the per-user
// tables' RLS policies key off of. This only has teeth because the app
// connects as a non-superuser, non-owner role (see scripts/init.sh) — RLS
// is bypassed for superusers/owners.
//
// Only called from two places, each of which first establishes who the
// user is: `locals.withRLS` (session, src/hooks.server.ts) and
// `authenticateBearer` (integration tokens). Everything else gets an
// already-bound `withRLS` rather than passing user ids around.
export function withUserRLS<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
	return db.transaction(async (tx) => {
		await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
		return fn(tx);
	});
}
