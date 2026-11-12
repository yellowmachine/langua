import { defineConfig } from '@playwright/test';
import { APP_PORT, appEnv, FAKE_SEILIDE_PORT, STORAGE_STATE } from './e2e/env';

// Needs the local Postgres (`bun run db:start`): the global setup creates a
// separate `langua_e2e` database with a signed-in member, and the AI is a
// fake Seilide (e2e/fake-seilide.ts), so nothing leaves the machine.
export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.{ts,js}',
	// The tests share one database and one signed-in member.
	workers: 1,
	globalSetup: './e2e/global-setup.ts',
	globalTeardown: './e2e/global-teardown.ts',
	use: {
		baseURL: `http://localhost:${APP_PORT}`,
		storageState: STORAGE_STATE,
		// A fake microphone, already allowed, for the recording buttons.
		launchOptions: {
			args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
		},
		permissions: ['microphone']
	},
	webServer: [
		{
			command: 'bun e2e/fake-seilide.ts',
			url: `http://localhost:${FAKE_SEILIDE_PORT}/health`,
			env: { FAKE_SEILIDE_PORT: String(FAKE_SEILIDE_PORT) }
		},
		{
			command: 'bun run build && node build',
			url: `http://localhost:${APP_PORT}/login`,
			env: appEnv(),
			timeout: 180_000
		}
	]
});
