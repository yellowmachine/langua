import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth';
import { auth } from '$lib/server/auth';
import { hasPendingTwoFactor, twoFactorErrorMessage } from '$lib/server/two-factor';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (locals.user) redirect(303, '/dashboard');
	if (!(await hasPendingTwoFactor(cookies))) redirect(303, '/login');
};

export const actions: Actions = {
	default: async (event) => {
		const data = await event.request.formData();
		const code = String(data.get('code') ?? '').replace(/\s/g, '');
		const useBackupCode = data.get('method') === 'backup';
		const trustDevice = data.get('trustDevice') === 'on';

		if (!code) {
			return fail(400, { useBackupCode, message: 'Introduce el código.' });
		}

		try {
			if (useBackupCode) {
				await auth.api.verifyBackupCode({
					body: { code, trustDevice },
					headers: event.request.headers
				});
			} else {
				await auth.api.verifyTOTP({
					body: { code, trustDevice },
					headers: event.request.headers
				});
			}
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { useBackupCode, message: twoFactorErrorMessage(error) });
			}
			throw error;
		}

		redirect(303, '/dashboard');
	}
};
