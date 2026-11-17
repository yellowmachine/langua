import { fail, redirect } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { integrationToken, user as userTable } from '$lib/server/db/schema';
import { generateIntegrationToken } from '$lib/server/api-auth';
import { auth } from '$lib/server/auth';
import { deleteAccount, getDeletionPreview, isRecentSession } from '$lib/server/account-deletion';
import { clipStorage } from '$lib/server/storage';
import { ACCENTS, isVoice } from '$lib/voices';
import { LANGUAGES } from '$lib/languages';
import { THEMES } from '$lib/theme.svelte';
import type { Actions, PageServerLoad } from './$types';

const MAX_TOKEN_NAME_LENGTH = 60;

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/login');

	const [tokens, deletion] = await Promise.all([
		locals.withRLS((tx) =>
			tx
				.select({
					id: integrationToken.id,
					name: integrationToken.name,
					createdAt: integrationToken.createdAt,
					lastUsedAt: integrationToken.lastUsedAt
				})
				.from(integrationToken)
				.orderBy(desc(integrationToken.createdAt))
		),
		getDeletionPreview(locals.withRLS)
	]);

	return { tokens, deletion, email: locals.user.email };
};

export const actions: Actions = {
	theme: async (event) => {
		if (!event.locals.user) redirect(303, '/login');

		const data = await event.request.formData();
		const requested = String(data.get('theme') ?? '');
		const theme = THEMES.some((t) => t.id === requested) ? requested : 'warm';
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

		const known = (code: string) => LANGUAGES.some((lang) => lang.code === code);
		if (!known(nativeLanguage) || !known(targetLanguage)) {
			return fail(400, { formId: 'language', message: 'Elige los dos idiomas.' });
		}

		await db
			.update(userTable)
			.set({ nativeLanguage, targetLanguage })
			.where(eq(userTable.id, event.locals.user.id));

		return { formId: 'language', success: true };
	},

	// The accent is the target language's: one of another language is dropped.
	voice: async (event) => {
		if (!event.locals.user) redirect(303, '/login');

		const data = await event.request.formData();
		const voice = String(data.get('voice') ?? '');
		const accent = String(data.get('accent') ?? '');
		const accents = ACCENTS[event.locals.user.targetLanguage ?? ''] ?? [];

		if (!isVoice(voice)) {
			return fail(400, { formId: 'voice', message: 'Elige una de las voces.' });
		}

		await db
			.update(userTable)
			.set({ voice, accent: accents.some((a) => a.code === accent) ? accent : null })
			.where(eq(userTable.id, event.locals.user.id));

		return { formId: 'voice', success: true };
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
	},

	// Sin contraseña (se entra con Seilide): el email escrito y una sesión de
	// hace menos de 15 minutos, por si alguien se encuentra la sesión abierta.
	deleteAccount: async (event) => {
		const { user, session } = event.locals;
		if (!user || !session) redirect(303, '/login');

		const data = await event.request.formData();
		const confirmEmail = String(data.get('confirmEmail') ?? '').trim();
		if (confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
			return fail(400, {
				formId: 'deleteAccount',
				message: 'El email no coincide con el de tu cuenta.',
				reauth: false
			});
		}
		if (!isRecentSession(session.createdAt)) {
			return fail(400, {
				formId: 'deleteAccount',
				message:
					'Por seguridad, vuelve a entrar antes de borrar la cuenta: tu sesión empezó hace más de 15 minutos.',
				reauth: true
			});
		}

		await deleteAccount(event.locals.withRLS, clipStorage, user.id);
		// La sesión se fue con la cuenta; esto borra la cookie.
		await auth.api
			.signOut({ headers: event.request.headers })
			.catch((err) => console.error('[account] signOut after delete failed:', err));
		redirect(303, '/login?account-deleted');
	}
};
