import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth';
import { auth } from '$lib/server/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	changePassword: async (event) => {
		const data = await event.request.formData();
		const currentPassword = String(data.get('currentPassword') ?? '');
		const newPassword = String(data.get('newPassword') ?? '');
		const confirmPassword = String(data.get('confirmPassword') ?? '');

		if (!currentPassword || !newPassword) {
			return fail(400, { message: 'Rellena todos los campos.' });
		}

		if (newPassword !== confirmPassword) {
			return fail(400, { message: 'Las contraseñas nuevas no coinciden.' });
		}

		try {
			await auth.api.changePassword({
				body: { currentPassword, newPassword, revokeOtherSessions: false },
				headers: event.request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message });
			}
			throw error;
		}

		return { success: true };
	}
};
