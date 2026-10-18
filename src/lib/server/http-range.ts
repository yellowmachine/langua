import type { ByteRange } from './storage';

/**
 * The single byte range of a `Range` request header, or null to serve the
 * whole thing — what the spec says to do with anything malformed, and what
 * we do with multi-range requests (an <audio> element never sends those).
 */
export function parseRangeHeader(header: string | null): ByteRange | null {
	const match = header?.trim().match(/^bytes=(\d*)-(\d*)$/);
	if (!match) return null;

	const [, start, end] = match;
	if (start) return { start: Number(start), end: end ? Number(end) : undefined };
	if (end) return { suffix: Number(end) };
	return null;
}
