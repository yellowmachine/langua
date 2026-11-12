import { afterEach, describe, expect, it, vi } from 'vitest';

const inserted = vi.fn();
vi.mock('$lib/server/db/rls', () => ({
	withUserRLS: (_userId: string, fn: (tx: unknown) => unknown) =>
		fn({ insert: () => ({ values: inserted }) })
}));

const { meteredFetch, readUsage, storedCost, usageOfStream } = await import('./usage');

afterEach(() => {
	vi.unstubAllGlobals();
	inserted.mockReset();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('readUsage', () => {
	it("keeps OpenRouter's charge and the tokens", () => {
		expect(readUsage({ prompt_tokens: 10, completion_tokens: 5, cost: 0.0002 })).toEqual({
			inputTokens: 10,
			outputTokens: 5,
			costUsd: 0.0002
		});
		expect(readUsage(undefined)).toEqual({ inputTokens: 0, outputTokens: 0, costUsd: null });
	});
});

describe('usageOfStream', () => {
	it('takes the usage from the last event that has one', () => {
		const text = [
			'data: {"choices":[{"delta":{"content":"Hi"}}]}',
			': OPENROUTER PROCESSING',
			'data: {"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":1,"cost":0.00001}}',
			'data: [DONE]'
		].join('\n\n');
		expect(usageOfStream(text)).toEqual({ prompt_tokens: 3, completion_tokens: 1, cost: 0.00001 });
	});
});

describe('storedCost', () => {
	it('prefers the charge, else estimates from the list price', async () => {
		expect(await storedCost('any', { inputTokens: 1, outputTokens: 1, costUsd: 0.5 })).toEqual({
			costUsd: '0.50000000',
			costIsEstimate: false
		});

		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				Response.json({
					data: [{ id: 'm/one', pricing: { prompt: '0.000001', completion: '0.000002' } }]
				})
			)
		);
		expect(
			await storedCost('m/one', { inputTokens: 100, outputTokens: 50, costUsd: null })
		).toEqual({ costUsd: '0.00020000', costIsEstimate: true });
	});
});

describe('meteredFetch', () => {
	it('notes a whole answer without changing it', async () => {
		const body = { choices: [], usage: { prompt_tokens: 7, completion_tokens: 2, cost: 0.0003 } };
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json(body))
		);

		const response = await meteredFetch('user-1', 'translation', 'm/one')('https://x');
		expect(await response.json()).toEqual(body);
		await flush();

		expect(inserted).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				task: 'translation',
				model: 'm/one',
				inputTokens: 7,
				outputTokens: 2,
				costUsd: '0.00030000',
				costIsEstimate: false
			})
		);
	});

	it('notes a stream once it has been read, passing it through whole', async () => {
		const events =
			'data: {"choices":[{"delta":{"content":"Hola"}}]}\n\n' +
			'data: {"choices":[],"usage":{"prompt_tokens":4,"completion_tokens":1,"cost":0.00002}}\n\n' +
			'data: [DONE]\n\n';
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(events, { headers: { 'Content-Type': 'text/event-stream' } }))
		);

		const response = await meteredFetch('user-1', 'chat', 'm/one')('https://x');
		expect(await response.text()).toBe(events);
		await flush();

		expect(inserted).toHaveBeenCalledWith(
			expect.objectContaining({ task: 'chat', inputTokens: 4, costUsd: '0.00002000' })
		);
	});

	it('notes nothing for a refused call', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('no', { status: 402 }))
		);
		const response = await meteredFetch('user-1', 'chat', 'm/one')('https://x');
		expect(response.status).toBe(402);
		await flush();
		expect(inserted).not.toHaveBeenCalled();
	});
});
