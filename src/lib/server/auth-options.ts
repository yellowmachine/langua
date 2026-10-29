import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth } from 'better-auth/plugins';
import * as schema from './db/schema';

type Db = Parameters<typeof drizzleAdapter>[0];

export const SEILIDE_PROVIDER_ID = 'seilide';

/**
 * Shared between the runtime auth instance (auth.ts) and the CLI-only config
 * (auth.cli.ts) used to generate the schema. Keeping this framework-agnostic
 * (no $app/* imports) is what lets the better-auth CLI load it outside Vite.
 */
export function createAuthOptions(params: {
	db: Db;
	secret: string;
	baseURL: string;
	seilide: { url: string; clientId: string; clientSecret: string };
	plugins?: BetterAuthOptions['plugins'];
}) {
	return {
		database: drizzleAdapter(params.db, { provider: 'pg', schema }),
		secret: params.secret,
		baseURL: params.baseURL,
		// Seilide (JellyCartoon's cloud) is the only way in. The account is
		// created on the first sign-in; one that already exists is linked by
		// email instead (see scripts/link-seilide.ts for accounts made before).
		account: {
			accountLinking: { enabled: true, trustedProviders: [SEILIDE_PROVIDER_ID] }
		},
		user: {
			additionalFields: {
				nativeLanguage: {
					type: 'string',
					required: false
				},
				targetLanguage: {
					type: 'string',
					required: false
				},
				theme: {
					type: 'string',
					defaultValue: 'warm'
				},
				dark: {
					type: 'boolean',
					defaultValue: false
				},
				highContrast: {
					type: 'boolean',
					defaultValue: false
				}
			}
		},
		plugins: [
			genericOAuth({
				config: [
					{
						providerId: SEILIDE_PROVIDER_ID,
						discoveryUrl: `${params.seilide.url}/api/auth/.well-known/openid-configuration`,
						clientId: params.seilide.clientId,
						clientSecret: params.seilide.clientSecret,
						authentication: 'basic',
						pkce: true,
						// `family` puts the family id in the token, which Seilide's AI
						// endpoint needs; `offline_access` gives the refresh token
						// getAccessToken uses once the 1-hour access token expires.
						scopes: ['openid', 'profile', 'email', 'offline_access', 'family']
					}
				]
			}),
			...(params.plugins ?? [])
		]
	} satisfies BetterAuthOptions;
}
