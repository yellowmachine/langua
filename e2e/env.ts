import { loadEnv } from 'vite';
import { withDatabase } from '../src/lib/server/db/test-database';

/** Shared by playwright.config.ts and the global setup/teardown. */
const fileEnv = { ...loadEnv('test', process.cwd(), ''), ...process.env };

export const E2E_DATABASE = 'langua_e2e';
export const APP_PORT = 4173;
export const FAKE_SEILIDE_PORT = 4010;
export const AUTH_SECRET = 'e2e-only-secret-not-for-anything-else';
export const SESSION_TOKEN = 'e2e-session-token';
export const STORAGE_STATE = 'e2e/.auth/state.json';

export const adminUrl = fileEnv.MIGRATION_DATABASE_URL;
export const appUrl = fileEnv.DATABASE_URL;

/** Environment for the app under test: its own database, a fake Seilide. */
export function appEnv(): Record<string, string> {
	return {
		PORT: String(APP_PORT),
		HOST: '127.0.0.1',
		ORIGIN: `http://localhost:${APP_PORT}`,
		DATABASE_URL: appUrl ? withDatabase(appUrl, E2E_DATABASE) : '',
		BETTER_AUTH_SECRET: AUTH_SECRET,
		BETTER_AUTH_URL: `http://localhost:${APP_PORT}`,
		SEILIDE_URL: `http://localhost:${FAKE_SEILIDE_PORT}`,
		SEILIDE_CLIENT_ID: 'e2e',
		SEILIDE_CLIENT_SECRET: 'e2e',
		OPENROUTER_MODEL: 'fake',
		AUDIO_CACHE_DIR: 'e2e/.data/audio',
		CLIPS_DIR: 'e2e/.data/clips',
		STT_BASE_URL: `http://localhost:${FAKE_SEILIDE_PORT}`
	};
}
