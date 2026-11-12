// What each AI call cost the member's family.
//
// Seilide passes OpenRouter's answers through as they come, and OpenRouter
// puts the real charge in `usage.cost` (USD credits, as its dashboard shows),
// streaming included: there it comes in the last event. That is the truth;
// when an answer comes without it, tokens × the model's list price is kept as
// an estimate. Speech comes back as bare audio, so its cost isn't known.

import type { AiTask } from '$lib/aiTasks';
import { aiUsage } from '$lib/server/db/schema';

/** The `usage` object of an OpenRouter answer (or of a stream's last event). */
export interface OpenRouterUsage {
	prompt_tokens?: number;
	completion_tokens?: number;
	cost?: number;
}

export interface Usage {
	inputTokens: number;
	outputTokens: number;
	/** What OpenRouter charged, in USD; null when the answer didn't say. */
	costUsd: number | null;
}

export function readUsage(usage: OpenRouterUsage | null | undefined): Usage {
	return {
		inputTokens: usage?.prompt_tokens ?? 0,
		outputTokens: usage?.completion_tokens ?? 0,
		costUsd: typeof usage?.cost === 'number' && Number.isFinite(usage.cost) ? usage.cost : null
	};
}

/** The usage in a streamed answer: the last `data: {...}` event that carries one. */
export function usageOfStream(text: string): OpenRouterUsage | undefined {
	let usage: OpenRouterUsage | undefined;
	for (const line of text.split('\n')) {
		const data = line.startsWith('data:') ? line.slice(5).trim() : '';
		if (!data || data === '[DONE]') continue;
		try {
			usage = JSON.parse(data).usage ?? usage;
		} catch {
			// A comment or a broken line: not the usage.
		}
	}
	return usage;
}

// ── List prices, for answers without a cost ─────────────────────────────────

type Price = { input: number; output: number };
let prices: { at: number; byModel: Record<string, Price> } | null = null;
const PRICES_TTL_MS = 60 * 60_000;

/** OpenRouter's public catalog (USD per token), fetched at most once an hour. */
export async function modelPrices(): Promise<Record<string, Price>> {
	if (prices && Date.now() - prices.at < PRICES_TTL_MS) return prices.byModel;
	try {
		const response = await fetch('https://openrouter.ai/api/v1/models', {
			headers: { 'User-Agent': 'Langua' },
			signal: AbortSignal.timeout(10_000)
		});
		if (!response.ok) return prices?.byModel ?? {};
		const { data } = (await response.json()) as {
			data: { id: string; pricing?: { prompt?: string; completion?: string } }[];
		};
		const byModel: Record<string, Price> = {};
		for (const model of data) {
			const input = Number(model.pricing?.prompt);
			const output = Number(model.pricing?.completion);
			if (Number.isFinite(input) && Number.isFinite(output)) byModel[model.id] = { input, output };
		}
		prices = { at: Date.now(), byModel };
		return byModel;
	} catch {
		return prices?.byModel ?? {};
	}
}

/** The cost to keep: the charge, else an estimate from the list price, else unknown. */
export async function storedCost(
	model: string,
	usage: Usage
): Promise<{ costUsd: string | null; costIsEstimate: boolean }> {
	if (usage.costUsd !== null) return { costUsd: usage.costUsd.toFixed(8), costIsEstimate: false };
	if (usage.inputTokens === 0 && usage.outputTokens === 0) {
		return { costUsd: null, costIsEstimate: false };
	}
	const price = (await modelPrices())[model];
	if (!price) return { costUsd: null, costIsEstimate: true };
	const estimate = usage.inputTokens * price.input + usage.outputTokens * price.output;
	return { costUsd: estimate.toFixed(8), costIsEstimate: true };
}

/** Notes one call. Never throws: a failed log must not fail what the learner asked for. */
export async function logUsage(entry: {
	userId: string;
	task: AiTask;
	model: string;
	usage: Usage;
	characters?: number;
}): Promise<void> {
	try {
		const cost = await storedCost(entry.model, entry.usage);
		// Loaded here so the AI modules stay importable without a database (tests).
		const { withUserRLS } = await import('$lib/server/db/rls');
		await withUserRLS(entry.userId, (tx) =>
			tx.insert(aiUsage).values({
				id: crypto.randomUUID(),
				userId: entry.userId,
				task: entry.task,
				model: entry.model,
				inputTokens: entry.usage.inputTokens,
				outputTokens: entry.usage.outputTokens,
				characters: entry.characters ?? null,
				...cost
			})
		);
	} catch (cause) {
		console.error('[ai usage] not logged', cause);
	}
}

/**
 * A `fetch` for the AI SDK's client that notes each successful completion's
 * usage for `userId` and `task`, without holding up the answer: a stream is
 * teed and read to its end on the side.
 */
export function meteredFetch(userId: string, task: AiTask, model: string): typeof fetch {
	const metered = async (input: RequestInfo | URL, init?: RequestInit) => {
		const response = await fetch(input, init);
		if (!response.ok || !response.body) return response;

		const note = (usage: OpenRouterUsage | undefined) =>
			logUsage({ userId, task, model, usage: readUsage(usage) });

		if (response.headers.get('content-type')?.includes('text/event-stream')) {
			const [toCaller, toCount] = response.body.tee();
			void new Response(toCount)
				.text()
				.then((text) => note(usageOfStream(text)))
				.catch(() => {
					// Cut short (the learner left): what was spent isn't known.
				});
			return new Response(toCaller, {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers
			});
		}

		void response
			.clone()
			.json()
			.then((body: { usage?: OpenRouterUsage }) => note(body?.usage))
			.catch(() => {});
		return response;
	};
	return metered as typeof fetch;
}
