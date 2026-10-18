/** The `data:` payload of each event in a text/event-stream body. */
export async function* serverSentEventData(
	body: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
	const decoder = new TextDecoder();
	let buffer = '';
	for await (const bytes of body) {
		const text = decoder.decode(bytes, { stream: true });
		// Normalized on the whole buffer, not per chunk: a \r\n can be split across two.
		buffer = (buffer + text).replace(/\r\n/g, '\n');
		let boundary;
		while ((boundary = buffer.indexOf('\n\n')) !== -1) {
			const event = buffer.slice(0, boundary);
			buffer = buffer.slice(boundary + 2);
			const data = eventData(event);
			if (data) yield data;
		}
	}
	const data = eventData(buffer);
	if (data) yield data;
}

function eventData(event: string): string | null {
	const lines = event
		.split('\n')
		.filter((line) => line.startsWith('data:'))
		.map((line) => line.slice(5).replace(/^ /, ''));
	return lines.length > 0 ? lines.join('\n') : null;
}
