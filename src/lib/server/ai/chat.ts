import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { env } from '$env/dynamic/private';
import { getEncryptedSetting, SETTINGS_KEYS } from '../settings';

const OLLAMA_BASE_URL = env.OLLAMA_BASE_URL ?? 'http://ollama:11434/v1';
const OLLAMA_MODEL = env.OLLAMA_MODEL ?? 'qwen2.5:1.5b';
const OPENROUTER_MODEL = env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini';

/**
 * Cloud (OpenRouter) if an admin configured a key in Settings, local
 * (Ollama, in-compose) otherwise. Both are OpenAI-compatible endpoints, so
 * one client shape covers either backend — see PLANNING.md §2.
 */
export async function getChatModel() {
	const apiKey = await getEncryptedSetting(SETTINGS_KEYS.OPENROUTER_API_KEY);

	if (apiKey) {
		const openrouter = createOpenAICompatible({
			name: 'openrouter',
			baseURL: 'https://openrouter.ai/api/v1',
			apiKey,
			// Needed for generateObject (e.g. the Escuchar module) to send a
			// real json_schema constraint instead of hoping the model free-forms
			// valid JSON — without this, small/local models routinely produce
			// structurally invalid output.
			supportsStructuredOutputs: true
		});
		return openrouter(OPENROUTER_MODEL);
	}

	const ollama = createOpenAICompatible({
		name: 'ollama',
		baseURL: OLLAMA_BASE_URL,
		supportsStructuredOutputs: true
	});
	return ollama(OLLAMA_MODEL);
}
