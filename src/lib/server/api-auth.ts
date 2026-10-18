import { createHash, randomBytes } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { db, type Tx } from './db';
import { integrationToken } from './db/schema';
import { withUserRLS } from './db/rls';

// Integration tokens (Mi cuenta → Integraciones) let other apps such as
// JellyCartoon call /api/v1/* as a given user. They're random and long, so
// a plain SHA-256 is enough to store them — no need for a slow KDF.

export function generateIntegrationToken(): { token: string; tokenHash: string } {
	const token = `lng_${randomBytes(32).toString('base64url')}`;
	return { token, tokenHash: hashIntegrationToken(token) };
}

function hashIntegrationToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/**
 * Verifies `Authorization: Bearer <token>` and returns a `withRLS` already
 * bound to the token's owner — the API counterpart of `locals.withRLS`, so
 * API routes never handle user ids themselves. Throws 401 otherwise.
 */
export async function authenticateBearer(request: Request): Promise<{
	userId: string;
	withRLS: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>;
}> {
	const match = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i);
	if (!match) error(401, 'Falta el token de Langua.');

	const tokenHash = hashIntegrationToken(match[1]);

	// We don't know whose token this is yet, so this can't go through
	// withUserRLS: the integration_token_lookup policy lets this transaction
	// see only the row whose hash it already holds. Kept in its own
	// transaction so app.token_hash never coexists with app.current_user_id.
	const row = await db.transaction(async (tx) => {
		await tx.execute(sql`SELECT set_config('app.token_hash', ${tokenHash}, true)`);
		const [found] = await tx
			.select({ id: integrationToken.id, userId: integrationToken.userId })
			.from(integrationToken)
			.where(eq(integrationToken.tokenHash, tokenHash));
		return found;
	});
	if (!row) error(401, 'El token de Langua no es válido o se ha revocado.');

	const userId = row.userId;
	const withRLS = <T>(fn: (tx: Tx) => Promise<T>) => withUserRLS(userId, fn);

	await withRLS((tx) =>
		tx
			.update(integrationToken)
			.set({ lastUsedAt: new Date() })
			.where(eq(integrationToken.id, row.id))
	);

	return { userId, withRLS };
}
