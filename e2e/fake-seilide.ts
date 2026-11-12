/**
 * Stand-in for Seilide's OpenAI-compatible AI endpoint in e2e tests, so they
 * run without a network, a family or any cost. Every chat completion gets a
 * fixed reply: streamed when asked to stream (the chat), whole otherwise
 * (the conversation's opening message). Structured-output requests (word
 * analysis, corrections…) get a 503, which the app treats as "couldn't".
 */
import { OPENING, REPLY } from './replies';

const port = Number(process.env.FAKE_SEILIDE_PORT ?? 4010);

function chunk(delta: Record<string, string>, finish: string | null = null) {
	return `data: ${JSON.stringify({
		id: 'fake',
		object: 'chat.completion.chunk',
		created: 0,
		model: 'fake',
		choices: [{ index: 0, delta, finish_reason: finish }]
	})}\n\n`;
}

Bun.serve({
	port,
	async fetch(request) {
		const url = new URL(request.url);
		if (url.pathname === '/health') return new Response('ok');
		if (url.pathname !== '/api/ia/v1/chat/completions') return new Response('', { status: 404 });

		const body = (await request.json()) as { stream?: boolean; response_format?: unknown };
		if (body.response_format) return new Response('no structured output here', { status: 503 });

		if (!body.stream) {
			return Response.json({
				id: 'fake',
				object: 'chat.completion',
				created: 0,
				model: 'fake',
				choices: [
					{ index: 0, message: { role: 'assistant', content: OPENING }, finish_reason: 'stop' }
				],
				usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
			});
		}

		const words = REPLY.split(/(?<= )/);
		const stream = new ReadableStream({
			async start(controller) {
				const encoder = new TextEncoder();
				controller.enqueue(encoder.encode(chunk({ role: 'assistant', content: '' })));
				for (const word of words) {
					controller.enqueue(encoder.encode(chunk({ content: word })));
					await Bun.sleep(20);
				}
				controller.enqueue(encoder.encode(chunk({}, 'stop')));
				controller.enqueue(encoder.encode('data: [DONE]\n\n'));
				controller.close();
			}
		});
		return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
	}
});

console.log(`fake Seilide on :${port}`);
