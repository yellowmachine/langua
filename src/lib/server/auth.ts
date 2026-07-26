import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL } from '$env/static/private';
import { db } from './db';
import { createAuthOptions } from './auth-options';

export const auth = betterAuth(
	createAuthOptions({
		db,
		secret: BETTER_AUTH_SECRET,
		baseURL: BETTER_AUTH_URL,
		plugins: [sveltekitCookies(getRequestEvent)]
	})
);
