import { afterEach, describe, expect, it, vi } from 'vitest';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { createAuthOptions } from './auth-options';

const SEILIDE = 'https://seilide.test';
const LANGUA = 'https://langua.test';

type Row = Record<string, unknown>;

// Seilide, as far as the sign-in needs it: discovery, token and userinfo.
function seilide(profile: Row) {
	return vi.fn(async (input: string | URL | Request) => {
		const url = String(input instanceof Request ? input.url : input);
		if (url.endsWith('/.well-known/openid-configuration')) {
			return Response.json({
				issuer: SEILIDE,
				authorization_endpoint: `${SEILIDE}/api/auth/oauth2/authorize`,
				token_endpoint: `${SEILIDE}/api/auth/oauth2/token`,
				userinfo_endpoint: `${SEILIDE}/api/auth/oauth2/userinfo`
			});
		}
		if (url.endsWith('/oauth2/token')) {
			return Response.json({
				access_token: 'access',
				refresh_token: 'refresh',
				token_type: 'Bearer',
				expires_in: 3600,
				scope: 'openid profile email offline_access family'
			});
		}
		if (url.endsWith('/oauth2/userinfo')) return Response.json(profile);
		return new Response('not found', { status: 404 });
	});
}

function createTestAuth(db: Record<string, Row[]>) {
	return betterAuth({
		...createAuthOptions({
			db: {} as never,
			secret: 'test-secret-test-secret-test-secret',
			baseURL: LANGUA,
			seilide: { url: SEILIDE, clientId: 'langua', clientSecret: 'secret' }
		}),
		database: memoryAdapter(db)
	});
}

/** Runs «Entrar con Seilide» end to end, as the browser would. */
async function signInWithSeilide(auth: ReturnType<typeof createTestAuth>) {
	const { headers, response } = await auth.api.signInWithOAuth2({
		body: { providerId: 'seilide', callbackURL: '/dashboard' },
		returnHeaders: true
	});
	const authorizeUrl = new URL(response.url);
	expect(authorizeUrl.searchParams.get('redirect_uri')).toBe(
		`${LANGUA}/api/auth/oauth2/callback/seilide`
	);
	expect(authorizeUrl.searchParams.get('code_challenge')).toBeTruthy();

	const cookie = headers
		.getSetCookie()
		.map((c) => c.split(';', 1)[0])
		.join('; ');
	const state = authorizeUrl.searchParams.get('state');
	return auth.handler(
		new Request(`${LANGUA}/api/auth/oauth2/callback/seilide?code=abc&state=${state}`, {
			headers: { cookie }
		})
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('Entrar con Seilide', () => {
	// As scripts/link-seilide.ts leaves an account made before Seilide.
	it('links an existing account with the same email instead of creating another', async () => {
		const now = new Date();
		const db: Record<string, Row[]> = {
			user: [
				{
					id: 'ana',
					name: 'Ana',
					email: 'ana@example.com',
					emailVerified: true,
					createdAt: now,
					updatedAt: now
				}
			],
			session: [],
			account: [],
			verification: []
		};
		vi.stubGlobal(
			'fetch',
			seilide({ sub: 'seilide-42', email: 'ana@example.com', email_verified: true, name: 'Ana' })
		);

		const response = await signInWithSeilide(createTestAuth(db));

		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe('/dashboard');
		expect(db.user).toHaveLength(1);
		expect(db.account).toEqual([
			expect.objectContaining({
				userId: 'ana',
				providerId: 'seilide',
				accountId: 'seilide-42',
				refreshToken: 'refresh'
			})
		]);
	});

	it('creates the account on the first sign-in', async () => {
		const db: Record<string, Row[]> = { user: [], session: [], account: [], verification: [] };
		vi.stubGlobal(
			'fetch',
			seilide({ sub: 'seilide-7', email: 'leo@example.com', email_verified: true, name: 'Leo' })
		);

		const response = await signInWithSeilide(createTestAuth(db));

		expect(response.status).toBe(302);
		expect(db.user).toEqual([expect.objectContaining({ email: 'leo@example.com', name: 'Leo' })]);
		expect(db.account).toEqual([
			expect.objectContaining({ userId: db.user[0].id, providerId: 'seilide' })
		]);
	});
});
