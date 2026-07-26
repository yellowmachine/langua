import { fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { APIError } from 'better-auth';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const members = await db
		.select({
			id: user.id,
			name: user.name,
			username: user.username,
			role: user.role,
			targetLanguage: user.targetLanguage
		})
		.from(user)
		.orderBy(asc(user.createdAt));

	return { members };
};

export const actions: Actions = {
	addMember: async (event) => {
		if (event.locals.user?.role !== 'admin') {
			return fail(403, { message: 'Solo el administrador puede añadir miembros.' });
		}

		const data = await event.request.formData();
		const name = String(data.get('name') ?? '').trim();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');
		const targetLanguage = String(data.get('targetLanguage') ?? '').trim();

		if (!name || !username || !password) {
			return fail(400, { message: 'Rellena nombre, usuario y contraseña.' });
		}

		try {
			const result = await auth.api.signUpEmail({
				body: { name, username, email: `${username}@family.local`, password },
				headers: event.request.headers
			});
			if (targetLanguage) {
				await db.update(user).set({ targetLanguage }).where(eq(user.id, result.user.id));
			}
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message });
			}
			throw error;
		}
	}
};
