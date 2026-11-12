/**
 * Row-Level Security against a real Postgres: one member of the family must
 * never see or touch another's rows, whatever the app code forgets.
 *
 * Runs on a throwaway database (created, migrated and dropped here) next to
 * the dev one, connecting as the app's restricted role just like the running
 * app does. Needs the local Postgres (`bun run db:start`) and the two URLs
 * from .env; without them the suite is skipped.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from 'vite';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';
import * as schema from './schema';
import { createTestDatabase, isReachable } from './test-database';

const env = { ...loadEnv('test', process.cwd(), ''), ...process.env };
const adminUrl = env.MIGRATION_DATABASE_URL;
const appUrl = env.DATABASE_URL;

const canRun = (await isReachable(adminUrl)) && Boolean(appUrl);

// Drizzle wraps the driver's error; Postgres' reason is in `cause`.
const rlsViolation = { cause: { message: expect.stringMatching(/row-level security/) } };

const A = 'rls-user-a';
const B = 'rls-user-b';

describe.skipIf(!canRun)('row-level security', () => {
	const database = `langua_rls_test_${process.pid}_${Date.now()}`;
	let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
	let appClient: postgres.Sql;
	let app: ReturnType<typeof drizzle<typeof schema>>;

	/** What `withUserRLS` does in the app: the policies key off this setting. */
	function as<T>(
		userId: string | null,
		fn: (tx: Parameters<Parameters<typeof app.transaction>[0]>[0]) => Promise<T>
	) {
		return app.transaction(async (tx) => {
			if (userId) await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
			return fn(tx);
		});
	}

	beforeAll(async () => {
		testDb = await createTestDatabase(adminUrl!, appUrl!, database);
		const owner = testDb.owner;

		// Fixtures go in as the owner, which RLS doesn't apply to.
		await owner.insert(schema.user).values([
			{ id: A, name: 'A', email: 'a@rls.test' },
			{ id: B, name: 'B', email: 'b@rls.test' }
		]);
		await owner.insert(schema.chatConversation).values([
			{ id: 'conv-a', userId: A, targetLanguage: 'en', level: 'beginner' },
			{ id: 'conv-b', userId: B, targetLanguage: 'fr', level: 'beginner' }
		]);
		await owner.insert(schema.chatMessage).values([
			{ id: 'msg-a', conversationId: 'conv-a', role: 'user', content: 'hello' },
			{ id: 'msg-b', conversationId: 'conv-b', role: 'user', content: 'bonjour' }
		]);
		const vocab = { targetLanguage: 'en', partOfSpeech: 'noun' as const, translation: 'x' };
		await owner.insert(schema.vocabItem).values([
			{ id: 'vocab-a', userId: A, lemma: 'cat', word: 'cat', exampleSentence: 'A cat.', ...vocab },
			{ id: 'vocab-b', userId: B, lemma: 'dog', word: 'dog', exampleSentence: 'A dog.', ...vocab }
		]);
		const attempt = { targetLanguage: 'en', passage: 'p', questions: [], score: 50 };
		await owner.insert(schema.listeningAttempt).values([
			{ id: 'listen-a', userId: A, ...attempt },
			{ id: 'listen-b', userId: B, ...attempt }
		]);
		await owner.insert(schema.vocabReview).values([
			{ id: 'review-a', userId: A, vocabItemId: 'vocab-a', rating: 3 },
			{ id: 'review-b', userId: B, vocabItemId: 'vocab-b', rating: 3 }
		]);
		const exercise = { targetLanguage: 'en', passage: 'p', questions: [] };
		await owner.insert(schema.listeningExercise).values([
			{ id: 'exercise-a', userId: A, ...exercise },
			{ id: 'exercise-b', userId: B, ...exercise }
		]);
		const clip = {
			source: 'jellycartoon',
			kind: 'episode' as const,
			title: 't',
			startSec: 0,
			endSec: 1,
			audioKey: 'k',
			audioSize: 1,
			audioType: 'audio/webm',
			capturedAt: new Date()
		};
		await owner.insert(schema.clip).values([
			{ id: 'clip-a', userId: A, ...clip, audioKey: 'ka' },
			{ id: 'clip-b', userId: B, ...clip, audioKey: 'kb' }
		]);
		await owner.insert(schema.integrationToken).values([
			{ id: 'token-a', userId: A, name: 'a', tokenHash: 'hash-a' },
			{ id: 'token-b', userId: B, name: 'b', tokenHash: 'hash-b' }
		]);

		appClient = postgres(testDb.appUrl, { max: 2, onnotice: () => {} });
		app = drizzle(appClient, { schema });
	});

	afterAll(async () => {
		await appClient?.end({ timeout: 1 });
		await testDb?.drop();
	});

	const tables = [
		['chat_conversation', schema.chatConversation, 'conv-a'],
		['chat_message', schema.chatMessage, 'msg-a'],
		['vocab_item', schema.vocabItem, 'vocab-a'],
		['vocab_review', schema.vocabReview, 'review-a'],
		['listening_attempt', schema.listeningAttempt, 'listen-a'],
		['listening_exercise', schema.listeningExercise, 'exercise-a'],
		['clip', schema.clip, 'clip-a'],
		['integration_token', schema.integrationToken, 'token-a']
	] as const;

	it.each(tables)('%s: a member only sees their own rows', async (_name, table, ownId) => {
		const rows = await as(A, (tx) => tx.select({ id: table.id }).from(table));
		expect(rows.map((row) => row.id)).toEqual([ownId]);
	});

	it.each(tables)('%s: nothing is visible without a user', async (_name, table) => {
		const rows = await as(null, (tx) => tx.select({ id: table.id }).from(table));
		expect(rows).toEqual([]);
	});

	it("can't update or delete another member's rows", async () => {
		const updated = await as(A, (tx) =>
			tx
				.update(schema.vocabItem)
				.set({ translation: 'hacked' })
				.where(eq(schema.vocabItem.id, 'vocab-b'))
				.returning({ id: schema.vocabItem.id })
		);
		const deleted = await as(A, (tx) =>
			tx
				.delete(schema.chatConversation)
				.where(eq(schema.chatConversation.id, 'conv-b'))
				.returning({ id: schema.chatConversation.id })
		);
		expect(updated).toEqual([]);
		expect(deleted).toEqual([]);

		const [stillB] = await as(B, (tx) =>
			tx.select().from(schema.vocabItem).where(eq(schema.vocabItem.id, 'vocab-b'))
		);
		expect(stillB.translation).toBe('x');
	});

	it("can't create rows in someone else's name", async () => {
		await expect(
			as(A, (tx) =>
				tx.insert(schema.chatConversation).values({
					id: 'conv-forged',
					userId: B,
					targetLanguage: 'en',
					level: 'beginner'
				})
			)
		).rejects.toMatchObject(rlsViolation);
	});

	it("can't add messages to another member's conversation", async () => {
		await expect(
			as(A, (tx) =>
				tx
					.insert(schema.chatMessage)
					.values({ id: 'msg-forged', conversationId: 'conv-b', role: 'user', content: 'hi' })
			)
		).rejects.toMatchObject(rlsViolation);
	});

	it('a bearer token hash only finds its own token', async () => {
		const rows = await app.transaction(async (tx) => {
			await tx.execute(sql`select set_config('app.token_hash', 'hash-b', true)`);
			return tx
				.select({ id: schema.integrationToken.id, userId: schema.integrationToken.userId })
				.from(schema.integrationToken);
		});
		expect(rows).toEqual([{ id: 'token-b', userId: B }]);
	});
});
