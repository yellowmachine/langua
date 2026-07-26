import { eq } from 'drizzle-orm';
import { db } from './db';
import { appSettings } from './db/schema';
import { encrypt, decrypt } from './crypto';

export const SETTINGS_KEYS = {
	OPENROUTER_API_KEY: 'openrouter_api_key'
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
