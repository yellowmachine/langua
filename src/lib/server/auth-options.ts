import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { username } from 'better-auth/plugins';
import * as schema from './db/schema';

type Db = Parameters<typeof drizzleAdapter>[0];

/**
 * Shared between the runtime auth instance (auth.ts) and the CLI-only config
 * (auth.cli.ts) used to generate the schema. Keeping this framework-agnostic
 * (no $app/* imports) is what lets the better-auth CLI load it outside Vite.
 */
export function createAuthOptions(params: {
	db: Db;
	secret: string;
	baseURL: string;
	plugins?: BetterAuthOptions['plugins'];
}) {
	return {
		database: drizzleAdapter(params.db, { provider: 'pg', schema }),
		secret: params.secret,
		baseURL: params.baseURL,
		emailAndPassword: {
			enabled: true,
			// Off by default: sign-up is also how an admin creates a family
			// member's account (POST /settings), and that must not swap out the
			// admin's own session cookie for the new member's. /setup and
			// /settings sign the resulting user in explicitly when needed.
			autoSignIn: false
		},
		user: {
			additionalFields: {
				role: {
					type: 'string',
					input: false,
					defaultValue: 'member'
				},
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
		plugins: [username(), ...(params.plugins ?? [])]
	} satisfies BetterAuthOptions;
}
