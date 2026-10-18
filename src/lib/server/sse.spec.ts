import { describe, expect, it } from 'vitest';
import { serverSentEventData } from './sse';

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
			controller.close();
		}
	});
}

async function collect(chunks: string[]): Promise<string[]> {
	const events: string[] = [];
	for await (const data of serverSentEventData(streamOf(chunks))) events.push(data);
	return events;
}

describe('serverSentEventData', () => {
	it('yields the data of each event', async () => {
		expect(await collect(['data: {"a":1}\n\ndata: {"b":2}\n\n'])).toEqual(['{"a":1}', '{"b":2}']);
	});

	it('copes with events and \\r\\n split across chunks', async () => {
		expect(await collect(['data: {"a"', ':1}\r', '\n\r\nda', 'ta: {"b":2}\r\n\r\n'])).toEqual([
			'{"a":1}',
			'{"b":2}'
		]);
	});

	it('joins multi-line data, skips other fields and keeps a final unterminated event', async () => {
		expect(await collect([': ping\n\nevent: x\ndata: one\ndata: two\n\ndata: last'])).toEqual([
			'one\ntwo',
			'last'
		]);
	});
});
