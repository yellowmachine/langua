/**
 * Stand-in for Seilide's OpenAI-compatible AI endpoint in e2e tests, so they
 * run without a network, a family or any cost. Every chat completion gets a
 * fixed reply: streamed when asked to stream (the chat), whole otherwise
 * (the conversation's opening message). Structured-output requests (word
 * analysis, corrections…) get a 503, which the app treats as "couldn't".
 */
import { HEARD, OPENING, REPLY, SPEAKING_SENTENCE, SPEAKING_TRANSLATION } from './replies';

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

function completion(content: string) {
	return Response.json({
		id: 'fake',
		object: 'chat.completion',
		created: 0,
		model: 'fake',
		choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
		usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
	});
}

Bun.serve({
	port,
	async fetch(request) {
		const url = new URL(request.url);
		if (url.pathname === '/health') return new Response('ok');
		// Also stands in for the local STT (STT_BASE_URL).
		if (url.pathname === '/v1/audio/transcriptions') return Response.json({ text: HEARD });
		if (url.pathname !== '/api/ia/v1/chat/completions') return new Response('', { status: 404 });

		const body = (await request.json()) as {
			stream?: boolean;
			response_format?: { json_schema?: { schema?: { properties?: Record<string, unknown> } } };
		};
		if (body.response_format) {
			const properties = Object.keys(body.response_format.json_schema?.schema?.properties ?? {});
			// Hablar's sentence; any other structured request is refused.
			if (properties.includes('sentence') && properties.includes('translation')) {
				return completion(
					JSON.stringify({ sentence: SPEAKING_SENTENCE, translation: SPEAKING_TRANSLATION })
				);
			}
			return new Response('no structured output here', { status: 503 });
		}

		if (!body.stream) return completion(OPENING);

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
