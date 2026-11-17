/**
 * Exportar contra un Postgres real, con el rol restringido de la app (como
 * rls.spec.ts): todo lo de A, agrupado, y nada de B ni de lo que no se
 * exporta (hash de los tokens, clave del audio). Sin la base de datos local,
 * se salta.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from 'vite';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import * as schema from './db/schema';
import { createTestDatabase, isReachable } from './db/test-database';
import type { WithRLS } from './db/rls';
import { getExportData } from './export';

const env = { ...loadEnv('test', process.cwd(), ''), ...process.env };
const adminUrl = env.MIGRATION_DATABASE_URL;
const appUrl = env.DATABASE_URL;
const canRun = (await isReachable(adminUrl)) && Boolean(appUrl);

const A = 'exp-user-a';
const B = 'exp-user-b';

describe.skipIf(!canRun)('getExportData', () => {
	const database = `langua_export_test_${process.pid}_${Date.now()}`;
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
			{ id: A, name: 'A', email: 'a@exp.test', nativeLanguage: 'es', targetLanguage: 'en' },
			{ id: B, name: 'B', email: 'b@exp.test' }
		]);
		await owner.insert(schema.chatConversation).values([
			{ id: 'conv-a', userId: A, targetLanguage: 'en', level: 'beginner' },
			{ id: 'conv-b', userId: B, targetLanguage: 'fr', level: 'beginner' }
		]);
		await owner.insert(schema.chatMessage).values([
			{ id: 'msg-a', conversationId: 'conv-a', role: 'user', content: 'hello' },
			{ id: 'msg-b', conversationId: 'conv-b', role: 'user', content: 'bonjour' }
		]);
		const word = (id: string, userId: string, lemma: string) => ({
			id,
			userId,
			targetLanguage: 'en',
			lemma,
			word: lemma,
			partOfSpeech: 'noun' as const,
			translation: lemma,
			exampleSentence: lemma
		});
		await owner.insert(schema.vocabItem).values([word('w-a', A, 'cat'), word('w-b', B, 'dog')]);
		await owner.insert(schema.vocabReview).values([
			{ id: 'r-a', userId: A, vocabItemId: 'w-a', rating: 3 },
			{ id: 'r-b', userId: B, vocabItemId: 'w-b', rating: 1 }
		]);
		await owner.insert(schema.clip).values({
			id: 'clip-a',
			userId: A,
			source: 'test',
			kind: 'film',
			title: 'Film',
			startSec: 0,
			endSec: 1,
			audioKey: 'clip-a.m4a',
			audioSize: 1,
			audioType: 'audio/mp4',
			capturedAt: new Date()
		});
		await owner.insert(schema.integrationToken).values([
			{ id: 't-a', userId: A, name: 'JellyCartoon', tokenHash: 'hash-a' },
			{ id: 't-b', userId: B, name: 'Other', tokenHash: 'hash-b' }
		]);
	});

	afterAll(async () => {
		await appClient?.end({ timeout: 1 });
		await testDb?.drop();
	});

	it("exports everything of the user's, grouped, and nothing of anyone else's", async () => {
		const data = await getExportData(withRLSFor(A), A);

		expect(data.account).toMatchObject({ name: 'A', email: 'a@exp.test', targetLanguage: 'en' });
		expect(data.conversations).toHaveLength(1);
		expect(data.conversations[0].id).toBe('conv-a');
		expect(data.conversations[0].messages).toEqual([
			expect.objectContaining({ role: 'user', content: 'hello' })
		]);
		expect(data.vocabulary.map((w) => w.lemma)).toEqual(['cat']);
		expect(data.vocabulary[0].reviews).toEqual([expect.objectContaining({ rating: 3 })]);
		expect(data.clips.map((c) => c.title)).toEqual(['Film']);
		expect(data.integrationTokens).toEqual([expect.objectContaining({ name: 'JellyCartoon' })]);

		const json = JSON.stringify(data);
		for (const leak of ['bonjour', 'dog', 'b@exp.test', 'hash-a', 'clip-a.m4a', A]) {
			expect(json).not.toContain(leak);
		}
	});
});
