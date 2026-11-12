import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from './schema';

/** Same URL, another database. */
export function withDatabase(url: string, database: string): string {
	const parsed = new URL(url);
	parsed.pathname = `/${database}`;
	return parsed.toString();
}

/** Whether a Postgres answers at `url` (tests skip themselves otherwise). */
export async function isReachable(url: string | undefined): Promise<boolean> {
	if (!url) return false;
	const probe = postgres(url, { max: 1, connect_timeout: 2, onnotice: () => {} });
	try {
		await probe`select 1`;
		return true;
	} catch {
		return false;
	} finally {
		await probe.end({ timeout: 1 });
	}
}

/**
 * A throwaway database for tests, next to the dev one: created and migrated
 * as the superuser (`adminUrl`, i.e. MIGRATION_DATABASE_URL), with the app's
 * restricted role (`appUrl`, i.e. DATABASE_URL) granted what scripts/init.sh
 * grants on the real one, so RLS applies exactly as in the running app.
 */
export async function createTestDatabase(adminUrl: string, appUrl: string, database: string) {
	const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
	await admin.unsafe(`drop database if exists "${database}" with (force)`);
	await admin.unsafe(`create database "${database}"`);

	const ownerClient = postgres(withDatabase(adminUrl, database), { max: 1, onnotice: () => {} });
	const owner = drizzle(ownerClient, { schema });
	await migrate(owner, { migrationsFolder: './drizzle' });

	const appRole = decodeURIComponent(new URL(appUrl).username);
	await ownerClient.unsafe(`
		grant connect on database "${database}" to "${appRole}";
		grant usage on schema public to "${appRole}";
		grant select, insert, update, delete on all tables in schema public to "${appRole}";
		grant usage, select, update on all sequences in schema public to "${appRole}";
	`);

	return {
		/** Bypasses RLS (table owner): for fixtures. */
		owner,
		/** Connection string for the app's role on this database. */
		appUrl: withDatabase(appUrl, database),
		async drop() {
			await ownerClient.end({ timeout: 1 });
			await admin.unsafe(`drop database if exists "${database}" with (force)`);
			await admin.end({ timeout: 1 });
		}
	};
}
