// Config used only by the better-auth CLI (`bun run auth:schema`), which runs
// outside Vite and can't resolve SvelteKit's `$app/*` virtual modules. The
// running app uses auth.ts instead — see createAuthOptions in auth-options.ts.
import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createAuthOptions } from './auth-options';
import * as schema from './db/schema';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const db = drizzle(postgres(databaseUrl), { schema });

export const auth = betterAuth(
	createAuthOptions({
		db,
		secret: process.env.BETTER_AUTH_SECRET ?? 'cli-only-placeholder',
		baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:5173'
	})
);
