import postgres from 'postgres';
import { adminUrl, E2E_DATABASE } from './env';

export default async function globalTeardown() {
	if (!adminUrl) return;
	const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
	await admin.unsafe(`drop database if exists "${E2E_DATABASE}" with (force)`);
	await admin.end({ timeout: 1 });
}
