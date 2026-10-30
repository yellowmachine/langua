import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { auth } from '../auth';
import { SEILIDE_PROVIDER_ID } from '../auth-options';

const OPENROUTER_MODEL = env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini';

/**
 * Seilide's AI endpoint, OpenAI-compatible: it calls OpenRouter with the
 * key of the family the access token belongs to, and books the cost under
 * Gastos → IA labelled with X-Title. Kept apart from getChatModel so it can
 * be tested without a database or a network.
 */
export function createSeilideModel(params: {
	seilideUrl: string;
	accessToken: string;
	modelId: string;
}) {
	const seilide = createOpenAICompatible({
		name: 'seilide',
		baseURL: `${params.seilideUrl}/api/ia/v1`,
		apiKey: params.accessToken,
		headers: { 'X-Title': 'Langua' },
		// Needed for generateObject (e.g. the Escuchar module) to send a
		// real json_schema constraint instead of hoping the model free-forms
		// valid JSON.
		supportsStructuredOutputs: true
	});
	return seilide(params.modelId);
}

/**
 * `userId`'s Seilide access token, for its AI endpoints: what they ask is
 * paid for by that user's family. getAccessToken refreshes the 1-hour access
 * token with the stored refresh token when it has expired.
 */
export async function getSeilideAccessToken(userId: string): Promise<string> {
	let accessToken: string | undefined;
	try {
		({ accessToken } = await auth.api.getAccessToken({
			body: { providerId: SEILIDE_PROVIDER_ID, userId }
		}));
	} catch {
		// No Seilide account linked, or the refresh token was revoked.
	}
	if (!accessToken) error(401, 'Tu sesión con Seilide ha caducado. Sal y vuelve a entrar.');
	return accessToken;
}

/** The model, on behalf of `userId` (see getSeilideAccessToken). */
export async function getChatModel(userId: string) {
	const accessToken = await getSeilideAccessToken(userId);

	return createSeilideModel({
		seilideUrl: env.SEILIDE_URL!,
		accessToken,
		modelId: OPENROUTER_MODEL
	});
}
