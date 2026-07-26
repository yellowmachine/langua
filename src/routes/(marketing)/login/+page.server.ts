import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, '/dashboard');

	const [existing] = await db.select({ id: user.id }).from(user).limit(1);
	if (!existing) redirect(303, '/setup');
};

export const actions: Actions = {
	default: async (event) => {
		const data = await event.request.formData();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');

		if (!username || !password) {
			return fail(400, { message: 'Introduce usuario y contraseña.' });
		}

		try {
			await auth.api.signInUsername({
				body: { username, password },
				headers: event.request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: 'Usuario o contraseña incorrectos.' });
			}
			throw error;
		}

		redirect(303, '/dashboard');
	}
};
