import { describe, expect, it } from 'vitest';
import { buildHighlightSegments } from './textHighlight';

describe('buildHighlightSegments', () => {
	it('returns a single unmarked segment when there are no errors', () => {
		expect(buildHighlightSegments('hello world', [])).toEqual([
			{ text: 'hello world', type: null }
		]);
	});

	it('marks a fragment in the middle of the text', () => {
		const segments = buildHighlightSegments('I goed to the store', [
			{ fragment: 'goed', type: 'grammar' }
		]);
		expect(segments).toEqual([
			{ text: 'I ', type: null },
			{ text: 'goed', type: 'grammar' },
			{ text: ' to the store', type: null }
		]);
	});

	it('handles multiple non-overlapping fragments out of order', () => {
		const segments = buildHighlightSegments('recieve a mesage today', [
			{ fragment: 'mesage', type: 'spelling' },
			{ fragment: 'recieve', type: 'spelling' }
		]);
		expect(segments).toEqual([
			{ text: 'recieve', type: 'spelling' },
			{ text: ' a ', type: null },
			{ text: 'mesage', type: 'spelling' },
			{ text: ' today', type: null }
		]);
	});

	it('ignores fragments that do not appear in the text', () => {
		const segments = buildHighlightSegments('all good here', [
			{ fragment: 'nonexistent', type: 'grammar' }
		]);
		expect(segments).toEqual([{ text: 'all good here', type: null }]);
	});

	it('skips overlapping fragments, keeping the first match', () => {
		const segments = buildHighlightSegments('goeded wrong', [
			{ fragment: 'goeded', type: 'grammar' },
			{ fragment: 'eded', type: 'spelling' }
		]);
		expect(segments).toEqual([
			{ text: 'goeded', type: 'grammar' },
			{ text: ' wrong', type: null }
		]);
	});
});
