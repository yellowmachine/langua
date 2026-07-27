import { fail, redirect } from '@sveltejs/kit';
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

	const { mode, apiKey } = await getResolvedAiMode();
	return { hasOpenRouterKey: Boolean(apiKey), aiMode: mode };
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
		await setAiMode('local');
	},

	setMode: async (event) => {
		if (event.locals.user?.role !== 'admin') return fail(403);

		const data = await event.request.formData();
		const mode = data.get('mode');
		if (mode !== 'local' && mode !== 'cloud') return fail(400, { message: 'Modo inválido.' });

		if (mode === 'cloud') {
			const apiKey = await getEncryptedSetting(SETTINGS_KEYS.OPENROUTER_API_KEY);
			if (!apiKey) {
				return fail(400, { message: 'Guarda una API key antes de activar el modo cloud.' });
			}
		}

		await setAiMode(mode);
	}
};
