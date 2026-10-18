import { describe, expect, it } from 'vitest';
import { parseRangeHeader } from './http-range';

describe('parseRangeHeader', () => {
	it('parses the three single-range forms', () => {
		expect(parseRangeHeader('bytes=0-499')).toEqual({ start: 0, end: 499 });
		expect(parseRangeHeader('bytes=500-')).toEqual({ start: 500, end: undefined });
		expect(parseRangeHeader('bytes=-500')).toEqual({ suffix: 500 });
	});

	it('ignores missing, malformed and multi-range headers', () => {
		for (const header of [null, '', 'bytes=-', 'bytes=a-b', 'items=0-1', 'bytes=0-1,5-9']) {
			expect(parseRangeHeader(header)).toBeNull();
		}
	});
});
