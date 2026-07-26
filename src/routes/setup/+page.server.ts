import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [existing] = await db.select({ id: user.id }).from(user).limit(1);
	if (existing) redirect(303, '/login');
};

export const actions: Actions = {
	default: async (event) => {
		const [existing] = await db.select({ id: user.id }).from(user).limit(1);
		if (existing) redirect(303, '/login');

		const data = await event.request.formData();
		const name = String(data.get('name') ?? '').trim();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');

		if (!name || !username || !password) {
			return fail(400, { message: 'Rellena todos los campos.' });
		}

		try {
			const result = await auth.api.signUpEmail({
				body: { name, username, email: `${username}@family.local`, password },
				headers: event.request.headers
			});
			await db.update(user).set({ role: 'admin' }).where(eq(user.id, result.user.id));
			// autoSignIn is off (see auth-options.ts), so log the new admin in explicitly.
			await auth.api.signInUsername({
				body: { username, password },
				headers: event.request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message });
			}
			throw error;
		}

		redirect(303, '/dashboard');
	}
};
