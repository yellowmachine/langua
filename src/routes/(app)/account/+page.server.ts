import { fail, redirect } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { integrationToken } from '$lib/server/db/schema';
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
