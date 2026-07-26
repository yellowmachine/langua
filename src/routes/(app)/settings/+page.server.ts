import { fail, redirect } from '@sveltejs/kit';
import { getEncryptedSetting, setEncryptedSetting, SETTINGS_KEYS } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user?.role !== 'admin') redirect(303, '/');

	const apiKey = await getEncryptedSetting(SETTINGS_KEYS.OPENROUTER_API_KEY);
	return { hasOpenRouterKey: Boolean(apiKey) };
};

export const actions: Actions = {
	save: async (event) => {
		if (event.locals.user?.role !== 'admin') return fail(403);

		const data = await event.request.formData();
		const apiKey = String(data.get('apiKey') ?? '').trim();
		if (!apiKey) return fail(400, { message: 'Introduce una API key.' });

		await setEncryptedSetting(SETTINGS_KEYS.OPENROUTER_API_KEY, apiKey);
	},

	clear: async (event) => {
		if (event.locals.user?.role !== 'admin') return fail(403);
		await setEncryptedSetting(SETTINGS_KEYS.OPENROUTER_API_KEY, null);
	}
};
