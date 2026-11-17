/**
 * Borrar la cuenta contra un Postgres real, con el rol restringido de la app
 * (como rls.spec.ts): la cascada tiene que funcionar bajo RLS, sin tocar a
 * nadie más, y el audio de sus clips tiene que irse. Sin la base de datos
 * local, la suite de base de datos se salta.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from 'vite';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';
import * as schema from './db/schema';
import { createTestDatabase, isReachable } from './db/test-database';
import type { WithRLS } from './db/rls';
import type { ObjectStorage } from './storage/types';
import {
	RECENT_SESSION_MS,
	deleteAccount,
	getDeletionPreview,
	isRecentSession
} from './account-deletion';

describe('isRecentSession', () => {
	const now = Date.UTC(2026, 10, 17, 12);
	it('accepts a session younger than 15 minutes', () => {
		expect(isRecentSession(new Date(now - RECENT_SESSION_MS + 1000), now)).toBe(true);
	});
	it('rejects an older one', () => {
		expect(isRecentSession(new Date(now - RECENT_SESSION_MS), now)).toBe(false);
	});
});

const env = { ...loadEnv('test', process.cwd(), ''), ...process.env };
const adminUrl = env.MIGRATION_DATABASE_URL;
const appUrl = env.DATABASE_URL;
const canRun = (await isReachable(adminUrl)) && Boolean(appUrl);

const A = 'del-user-a';
const B = 'del-user-b';

describe.skipIf(!canRun)('deleteAccount', () => {
	const database = `langua_deletion_test_${process.pid}_${Date.now()}`;
	let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
	let appClient: postgres.Sql;
	let app: ReturnType<typeof drizzle<typeof schema>>;

	const withRLSFor =
		(userId: string): WithRLS =>
		(fn) =>
			app.transaction(async (tx) => {
				await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
				return fn(tx);
			});

	beforeAll(async () => {
		testDb = await createTestDatabase(adminUrl!, appUrl!, database);
		const owner = testDb.owner;
		appClient = postgres(testDb.appUrl, { max: 1, onnotice: () => {} });
		app = drizzle(appClient, { schema });

		await owner.insert(schema.user).values([
			{ id: A, name: 'A', email: 'a@del.test' },
			{ id: B, name: 'B', email: 'b@del.test' }
		]);
		await owner.insert(schema.session).values({
			id: 'sess-a',
			userId: A,
			token: 'tok-a',
			expiresAt: new Date(Date.now() + 3600_000),
			createdAt: new Date(),
			updatedAt: new Date()
		});
		await owner.insert(schema.chatConversation).values([
			{ id: 'conv-a', userId: A, targetLanguage: 'en', level: 'beginner' },
			{ id: 'conv-b', userId: B, targetLanguage: 'fr', level: 'beginner' }
		]);
		const clipFor = (id: string, userId: string) => ({
			id,
			userId,
			source: 'test',
			kind: 'film' as const,
			title: id,
			startSec: 0,
			endSec: 1,
			audioKey: `${id}.m4a`,
			audioSize: 1,
			audioType: 'audio/mp4',
			capturedAt: new Date()
		});
		await owner.insert(schema.clip).values([clipFor('clip-a', A), clipFor('clip-b', B)]);
	});

	afterAll(async () => {
		await appClient?.end({ timeout: 1 });
		await testDb?.drop();
	});

	it('previews what will be lost', async () => {
		expect(await getDeletionPreview(withRLSFor(A))).toEqual({
			conversations: 1,
			words: 0,
			clips: 1
		});
	});

	it('deletes the account, its rows and its clip audio, and nothing of anyone else', async () => {
		const deletedKeys: string[] = [];
		const storage: ObjectStorage = {
			put: async () => {},
			get: async () => null,
			delete: async (key) => void deletedKeys.push(key)
		};

		await deleteAccount(withRLSFor(A), storage, A);

		const owner = testDb.owner;
		expect(await owner.select().from(schema.user).where(eq(schema.user.id, A))).toEqual([]);
		expect(await owner.select().from(schema.session)).toEqual([]);
		expect((await owner.select().from(schema.chatConversation)).map((c) => c.id)).toEqual([
			'conv-b'
		]);
		expect((await owner.select().from(schema.clip)).map((c) => c.id)).toEqual(['clip-b']);
		expect(deletedKeys).toEqual(['clip-a.m4a']);
	});

	it('fails on an account that does not exist', async () => {
		const storage = { put: async () => {}, get: async () => null, delete: async () => {} };
		await expect(deleteAccount(withRLSFor('nobody'), storage, 'nobody')).rejects.toThrow(
			'Account not found'
		);
	});
});
