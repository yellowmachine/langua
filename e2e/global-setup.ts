import { createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import * as schema from '../src/lib/server/db/schema';
import { createTestDatabase } from '../src/lib/server/db/test-database';
import {
	adminUrl,
	appUrl,
	APP_PORT,
	AUTH_SECRET,
	E2E_DATABASE,
	SESSION_TOKEN,
	STORAGE_STATE
} from './env';

/**
 * Fresh e2e database with one signed-in member, as if they had just come
 * back from Seilide: a user with languages set, a Seilide account whose
 * access token is valid for a day (so the fake AI endpoint accepts calls
 * without a refresh) and a session, whose signed cookie goes into the
 * browser's storage state.
 */
export default async function globalSetup() {
	if (!adminUrl || !appUrl) {
		throw new Error(
			'e2e needs MIGRATION_DATABASE_URL and DATABASE_URL (.env) and `bun run db:start`'
		);
	}
	const { owner } = await createTestDatabase(adminUrl, appUrl, E2E_DATABASE);

	const userId = 'e2e-user';
	const tomorrow = new Date(Date.now() + 24 * 3600_000);
	await owner.insert(schema.user).values({
		id: userId,
		name: 'E2E',
		email: 'e2e@langua.test',
		emailVerified: true,
		nativeLanguage: 'es',
		targetLanguage: 'en'
	});
	await owner.insert(schema.account).values({
		id: 'e2e-account',
		accountId: 'e2e',
		providerId: 'seilide',
		userId,
		accessToken: 'fake-access-token',
		accessTokenExpiresAt: tomorrow
	});
	await owner.insert(schema.session).values({
		id: 'e2e-session',
		token: SESSION_TOKEN,
		userId,
		expiresAt: tomorrow
	});

	const vocab = { userId, targetLanguage: 'en', partOfSpeech: 'noun' as const };
	await owner.insert(schema.vocabItem).values([
		{
			id: 'vocab-cat',
			lemma: 'cat',
			word: 'cat',
			translation: 'gato',
			exampleSentence: 'The cat sleeps.',
			...vocab
		},
		{
			id: 'vocab-dog',
			lemma: 'dog',
			word: 'dog',
			translation: 'perro',
			exampleSentence: 'A dog barks.',
			...vocab
		}
	]);

	// better-auth's session cookie: `${token}.${base64 HMAC-SHA256}`, URL-encoded.
	const signature = createHmac('sha256', AUTH_SECRET).update(SESSION_TOKEN).digest('base64');
	await mkdir(dirname(STORAGE_STATE), { recursive: true });
	await writeFile(
		STORAGE_STATE,
		JSON.stringify({
			cookies: [
				{
					name: 'better-auth.session_token',
					value: encodeURIComponent(`${SESSION_TOKEN}.${signature}`),
					domain: 'localhost',
					path: '/',
					expires: Math.floor(tomorrow.getTime() / 1000),
					httpOnly: true,
					secure: false,
					sameSite: 'Lax'
				}
			],
			origins: [
				{
					origin: `http://localhost:${APP_PORT}`,
					// Don't read replies aloud: TTS isn't faked.
					localStorage: [{ name: 'langua-chat-autoplay', value: '0' }]
				}
			]
		})
	);
}
