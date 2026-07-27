import { eq } from 'drizzle-orm';
import { db } from './db';
import { appSettings } from './db/schema';
import { encrypt, decrypt } from './crypto';

export const SETTINGS_KEYS = {
	OPENROUTER_API_KEY: 'openrouter_api_key',
	AI_MODE: 'ai_mode'
} as const;

async function getSetting(key: string): Promise<string | null> {
	const [row] = await db
		.select({ value: appSettings.value })
		.from(appSettings)
		.where(eq(appSettings.key, key));
	return row?.value ?? null;
}

async function setSetting(key: string, value: string | null): Promise<void> {
	if (value === null) {
		await db.delete(appSettings).where(eq(appSettings.key, key));
		return;
	}
	await db
		.insert(appSettings)
		.values({ key, value })
		.onConflictDoUpdate({ target: appSettings.key, set: { value } });
}

export async function getEncryptedSetting(key: string): Promise<string | null> {
	const value = await getSetting(key);
	return value ? decrypt(value) : null;
}

export async function setEncryptedSetting(key: string, value: string | null): Promise<void> {
	await setSetting(key, value ? encrypt(value) : null);
}

export async function getResolvedAiMode(): Promise<{
	mode: 'local' | 'cloud';
	apiKey: string | null;
}> {
	const [apiKey, modeSetting] = await Promise.all([
		getEncryptedSetting(SETTINGS_KEYS.OPENROUTER_API_KEY),
		getSetting(SETTINGS_KEYS.AI_MODE)
	]);
	if (!apiKey) return { mode: 'local', apiKey: null };
	// No explicit preference recorded yet: preserve the pre-toggle behavior
	// (key present => cloud) for installs that already had a key saved
	// before this feature shipped, instead of silently dropping them to local.
	if (modeSetting === null) return { mode: 'cloud', apiKey };
	return { mode: modeSetting === 'cloud' ? 'cloud' : 'local', apiKey };
}

export async function setAiMode(mode: 'local' | 'cloud'): Promise<void> {
	await setSetting(SETTINGS_KEYS.AI_MODE, mode);
}
