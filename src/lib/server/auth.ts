import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { createAuthOptions } from './auth-options';

if (!env.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET is not set');
if (!env.BETTER_AUTH_URL) throw new Error('BETTER_AUTH_URL is not set');
if (!env.SEILIDE_URL || !env.SEILIDE_CLIENT_ID || !env.SEILIDE_CLIENT_SECRET) {
	throw new Error('SEILIDE_URL, SEILIDE_CLIENT_ID and SEILIDE_CLIENT_SECRET must be set');
}

export const auth = betterAuth(
	createAuthOptions({
		db,
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		seilide: {
			url: env.SEILIDE_URL,
			clientId: env.SEILIDE_CLIENT_ID,
			clientSecret: env.SEILIDE_CLIENT_SECRET
		},
		plugins: [sveltekitCookies(getRequestEvent)]
	})
);
