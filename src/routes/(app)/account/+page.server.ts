import { fail, redirect } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { integrationToken, user as userTable } from '$lib/server/db/schema';
import { generateIntegrationToken } from '$lib/server/api-auth';
import type { Actions, PageServerLoad } from './$types';

const MAX_TOKEN_NAME_LENGTH = 60;

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/login');

	const tokens = await locals.withRLS((tx) =>
		tx
			.select({
				id: integrationToken.id,
				name: integrationToken.name,
				createdAt: integrationToken.createdAt,
				lastUsedAt: integrationToken.lastUsedAt
			})
			.from(integrationToken)
			.orderBy(desc(integrationToken.createdAt))
	);

	return { tokens };
};

export const actions: Actions = {
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

	// Both are required: translations and explanations are written in the
	// native one, and the chat practises the other (see the (app) layout).
	language: async (event) => {
		if (!event.locals.user) redirect(303, '/login');

		const data = await event.request.formData();
		const nativeLanguage = String(data.get('nativeLanguage') ?? '').trim();
		const targetLanguage = String(data.get('targetLanguage') ?? '').trim();

		if (!nativeLanguage || !targetLanguage) {
			return fail(400, { formId: 'language', message: 'Elige los dos idiomas.' });
		}

		await db
			.update(userTable)
			.set({ nativeLanguage, targetLanguage })
			.where(eq(userTable.id, event.locals.user.id));

		return { formId: 'language', success: true };
	},

	// The token itself is only ever returned here, once — only its hash is stored.
	createToken: async (event) => {
		const data = await event.request.formData();
		const name = String(data.get('name') ?? '').trim();

		if (!name) {
			return fail(400, { formId: 'createToken', message: 'Ponle un nombre al token.' });
		}
		if (name.length > MAX_TOKEN_NAME_LENGTH) {
			return fail(400, {
				formId: 'createToken',
				message: `El nombre no puede pasar de ${MAX_TOKEN_NAME_LENGTH} caracteres.`
			});
		}

		const { token, tokenHash } = generateIntegrationToken();
		await event.locals.withRLS((tx) =>
			tx.insert(integrationToken).values({
				id: crypto.randomUUID(),
				userId: event.locals.user!.id,
				name,
				tokenHash
			})
		);

		return { formId: 'createToken', name, token };
	},

	revokeToken: async (event) => {
		const data = await event.request.formData();
		const id = String(data.get('id') ?? '');
		if (!id) return fail(400, { formId: 'revokeToken', message: 'Falta el token.' });

		await event.locals.withRLS((tx) =>
			tx.delete(integrationToken).where(eq(integrationToken.id, id))
		);

		return { formId: 'revokeToken', success: true };
	}
};
