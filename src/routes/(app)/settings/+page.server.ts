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

		if (mode !== 'local' && mode !== 'cloud') return fail(400, { message: 'Modo inválido.' });

		if (mode === 'cloud') {
			const currentKey = await getEncryptedSetting(SETTINGS_KEYS.OPENROUTER_API_KEY);
			if (!currentKey) {
				return fail(400, { message: 'Guarda una API key antes de activar el modo cloud.' });
			}
		}

		await setAiMode(mode);
	}
};
