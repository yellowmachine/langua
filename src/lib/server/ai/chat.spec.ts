import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateText } from 'ai';

const getAccessToken = vi.fn();

vi.mock('$env/dynamic/private', () => ({
	env: { SEILIDE_URL: 'https://seilide.test', OPENROUTER_MODEL: 'openai/gpt-4o-mini' }
}));
const insertedUsage = vi.fn();
vi.mock('$lib/server/db/rls', () => ({
	withUserRLS: (_userId: string, fn: (tx: unknown) => unknown) =>
		fn({ insert: () => ({ values: insertedUsage }) })
}));
vi.mock('../auth', () => ({ auth: { api: { getAccessToken } } }));

const { getChatModel } = await import('./chat');

function completion(text: string) {
	return Response.json({
		id: 'chatcmpl-1',
		object: 'chat.completion',
		created: 0,
		model: 'openai/gpt-4o-mini',
		choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
		usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
	getAccessToken.mockReset();
});

describe('getChatModel', () => {
	it("calls Seilide's AI endpoint with the user's own access token", async () => {
		getAccessToken.mockResolvedValue({ accessToken: 'seilide-token' });
		const fetchMock = vi.fn(async () => completion('Ciao!'));
		vi.stubGlobal('fetch', fetchMock);

		const { text } = await generateText({
			model: await getChatModel('user-1', 'chat'),
			prompt: 'Hi'
		});

		expect(text).toBe('Ciao!');
		expect(getAccessToken).toHaveBeenCalledWith({
			body: { providerId: 'seilide', userId: 'user-1' }
		});
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://seilide.test/api/ia/v1/chat/completions');
		const headers = new Headers(init.headers);
		expect(headers.get('authorization')).toBe('Bearer seilide-token');
		expect(headers.get('x-title')).toBe('Langua');
		expect(JSON.parse(String(init.body)).model).toBe('openai/gpt-4o-mini');
	});

	it('asks to sign in again when there is no usable Seilide token', async () => {
		getAccessToken.mockRejectedValue(new Error('Failed to refresh the access token'));

		await expect(getChatModel('user-1', 'chat')).rejects.toMatchObject({ status: 401 });
	});
});
