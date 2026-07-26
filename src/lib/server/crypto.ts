import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';

// API keys (e.g. OpenRouter) are stored encrypted in app_settings rather
// than in .env, so any admin can configure them from Settings without
// touching the server. AES-256-GCM, key from ENCRYPTION_KEY.
if (!env.ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY is not set');
const key = Buffer.from(env.ENCRYPTION_KEY, 'base64');
if (key.length !== 32) {
	throw new Error(
		'ENCRYPTION_KEY must be a base64-encoded 32-byte key, e.g. `openssl rand -base64 32`'
	);
}

export function encrypt(plaintext: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decrypt(encoded: string): string {
	const raw = Buffer.from(encoded, 'base64');
	const iv = raw.subarray(0, 12);
	const authTag = raw.subarray(12, 28);
	const ciphertext = raw.subarray(28);
	const decipher = createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(authTag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
