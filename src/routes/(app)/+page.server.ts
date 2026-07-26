import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/schema';
import type { Actions } from './$types';

export const actions: Actions = {
	logout: async (event) => {
		await auth.api.signOut({ headers: event.request.headers });
		redirect(303, '/login');
	},

	theme: async (event) => {
		if (!event.locals.user) redirect(303, '/login');

		const data = await event.request.formData();
		const theme = String(data.get('theme') ?? 'warm');
		const dark = data.get('dark') === '1';
		const highContrast = data.get('highContrast') === '1';

		await db
			.update(userTable)
			.set({ theme, dark, highContrast })
			.where(eq(userTable.id, event.locals.user.id));
	},

	language: async (event) => {
		if (!event.locals.user) redirect(303, '/login');

		const data = await event.request.formData();
		const nativeLanguage = String(data.get('nativeLanguage') ?? '').trim();
		const targetLanguage = String(data.get('targetLanguage') ?? '').trim();

		await db
			.update(userTable)
			.set({
				nativeLanguage: nativeLanguage || null,
				targetLanguage: targetLanguage || null
			})
			.where(eq(userTable.id, event.locals.user.id));
	}
};
