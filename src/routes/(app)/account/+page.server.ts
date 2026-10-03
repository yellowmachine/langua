import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { totpQrSvg, twoFactorErrorMessage } from '$lib/server/two-factor';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/login');

	// Read from the DB rather than locals.user: enabling/disabling 2FA
	// rotates the session, so locals still holds the pre-action user here.
	const [row] = await db
		.select({ twoFactorEnabled: user.twoFactorEnabled })
		.from(user)
		.where(eq(user.id, locals.user.id));

	return { twoFactorEnabled: row?.twoFactorEnabled ?? false };
};

export const actions: Actions = {
	changePassword: async (event) => {
		const data = await event.request.formData();
		const currentPassword = String(data.get('currentPassword') ?? '');
		const newPassword = String(data.get('newPassword') ?? '');
		const confirmPassword = String(data.get('confirmPassword') ?? '');

		if (!currentPassword || !newPassword) {
			return fail(400, { formId: 'changePassword', message: 'Rellena todos los campos.' });
		}

		if (newPassword !== confirmPassword) {
			return fail(400, {
				formId: 'changePassword',
				message: 'Las contraseñas nuevas no coinciden.'
			});
		}

		try {
			await auth.api.changePassword({
				body: { currentPassword, newPassword, revokeOtherSessions: false },
				headers: event.request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { formId: 'changePassword', message: error.message });
			}
			throw error;
		}

		return { formId: 'changePassword', success: true };
	},

	// Step 1 of setup: creates an unverified secret + backup codes. 2FA isn't
	// actually on until verifyTwoFactor confirms a code from the app.
	enableTwoFactor: async (event) => {
		const data = await event.request.formData();
		const password = String(data.get('password') ?? '');

		try {
			const { totpURI, backupCodes } = await auth.api.enableTwoFactor({
				body: { password },
				headers: event.request.headers
			});

			return {
				formId: 'enableTwoFactor',
				setup: {
					qrSvg: await totpQrSvg(totpURI),
					secret: new URL(totpURI).searchParams.get('secret') ?? '',
					backupCodes
				}
			};
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { formId: 'enableTwoFactor', message: twoFactorErrorMessage(error) });
			}
			throw error;
		}
	},

	verifyTwoFactor: async (event) => {
		const data = await event.request.formData();
		const code = String(data.get('code') ?? '').replace(/\s/g, '');

		try {
			await auth.api.verifyTOTP({ body: { code }, headers: event.request.headers });
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { formId: 'verifyTwoFactor', message: twoFactorErrorMessage(error) });
			}
			throw error;
		}

		return { formId: 'verifyTwoFactor', success: true };
	},

	disableTwoFactor: async (event) => {
		const data = await event.request.formData();
		const password = String(data.get('password') ?? '');

		try {
			await auth.api.disableTwoFactor({ body: { password }, headers: event.request.headers });
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { formId: 'disableTwoFactor', message: twoFactorErrorMessage(error) });
			}
			throw error;
		}

		return { formId: 'disableTwoFactor', success: true };
	},

	regenerateBackupCodes: async (event) => {
		const data = await event.request.formData();
		const password = String(data.get('password') ?? '');

		try {
			const { backupCodes } = await auth.api.generateBackupCodes({
				body: { password },
				headers: event.request.headers
			});
			return { formId: 'regenerateBackupCodes', backupCodes };
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, {
					formId: 'regenerateBackupCodes',
					message: twoFactorErrorMessage(error)
				});
			}
			throw error;
		}
	}
};
