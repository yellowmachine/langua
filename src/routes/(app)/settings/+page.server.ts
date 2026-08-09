import { fail, redirect } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { APIError } from 'better-auth';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import {
	getEncryptedSetting,
	setEncryptedSetting,
	getResolvedAiMode,
	setAiMode,
	SETTINGS_KEYS
} from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user?.role !== 'admin') redirect(303, '/');

	const [{ mode, apiKey }, members] = await Promise.all([
		getResolvedAiMode(),
		db
			.select({
				id: user.id,
				name: user.name,
				username: user.username,
				role: user.role,
				targetLanguage: user.targetLanguage
			})
			.from(user)
			.orderBy(asc(user.createdAt))
	]);

	return { hasOpenRouterKey: Boolean(apiKey), aiMode: mode, members };
};

export const actions: Actions = {
	addMember: async (event) => {
		if (event.locals.user?.role !== 'admin') {
			return fail(403, {
				formId: 'addMember',
				message: 'Solo el administrador puede añadir miembros.'
			});
		}

		const data = await event.request.formData();
		const name = String(data.get('name') ?? '').trim();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');
		const targetLanguage = String(data.get('targetLanguage') ?? '').trim();

		if (!name || !username || !password) {
			return fail(400, { formId: 'addMember', message: 'Rellena nombre, usuario y contraseña.' });
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
				return fail(400, { formId: 'addMember', message: error.message });
			}
			throw error;
		}
	},

	save: async (event) => {
		if (event.locals.user?.role !== 'admin') return fail(403);

		const data = await event.request.formData();
		const apiKey = String(data.get('apiKey') ?? '').trim();
		const deleteKey = data.get('deleteKey') === 'on';
		const mode = data.get('mode');

		if (deleteKey) {
			await setEncryptedSetting(SETTINGS_KEYS.OPENROUTER_API_KEY, null);
			await setAiMode('local');
			return;
		}

		// Blank field = leave the currently saved key untouched, don't wipe it.
		if (apiKey) {
			await setEncryptedSetting(SETTINGS_KEYS.OPENROUTER_API_KEY, apiKey);
		}

		if (mode !== 'local' && mode !== 'cloud') {
			return fail(400, { formId: 'save', message: 'Modo inválido.' });
		}

		if (mode === 'cloud') {
			const currentKey = await getEncryptedSetting(SETTINGS_KEYS.OPENROUTER_API_KEY);
			if (!currentKey) {
				return fail(400, {
					formId: 'save',
					message: 'Guarda una API key antes de activar el modo cloud.'
				});
			}
		}

		await setAiMode(mode);
	},

	resetMemberPassword: async (event) => {
		if (event.locals.user?.role !== 'admin') {
			return fail(403, {
				formId: 'resetMemberPassword',
				message: 'Solo el administrador puede cambiar contraseñas.'
			});
		}

		const data = await event.request.formData();
		const userId = String(data.get('userId') ?? '');
		const newPassword = String(data.get('newPassword') ?? '');

		if (!userId || !newPassword) {
			return fail(400, {
				formId: 'resetMemberPassword',
				message: 'Elige un miembro y una contraseña nueva.'
			});
		}

		if (newPassword.length < 8) {
			return fail(400, {
				formId: 'resetMemberPassword',
				message: 'La contraseña debe tener al menos 8 caracteres.'
			});
		}

		const ctx = await auth.$context;
		const hashedPassword = await ctx.password.hash(newPassword);
		await ctx.internalAdapter.updatePassword(userId, hashedPassword);

		return { formId: 'resetMemberPassword', success: true };
	}
};
