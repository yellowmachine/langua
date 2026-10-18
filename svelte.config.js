import adapter from '@sveltejs/adapter-node';
import { mdsvex } from 'mdsvex';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
		experimental: { async: true }
	},
	preprocess: [mdsvex({ extensions: ['.svx', '.md'] })],
	extensions: ['.svelte', '.svx', '.md'],
	kit: {
		adapter: adapter(),
		// SvelteKit's built-in origin check would reject the multipart POSTs
		// integrations (JellyCartoon) send server-to-server without an Origin
		// header. handleCsrf in src/hooks.server.ts does the same check but
		// skips /api/v1, which authenticates by bearer token, not cookies.
		csrf: {
			trustedOrigins: ['*']
		},
		experimental: {
			remoteFunctions: true
		},
		typescript: {
			config: (config) => {
				config.include.push('../drizzle.config.ts');
			}
		}
	}
};

export default config;
