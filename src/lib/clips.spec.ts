import { describe, expect, it } from 'vitest';
import { activeCueIndex, clipOrigin, cueSpan, formatTimestamp } from './clips';

const episode = {
	kind: 'episode' as const,
	title: 'The One with the Race Car Bed',
	series: 'Friends',
	season: 3,
	episode: 7,
	year: null,
	startSec: 300,
	endSec: 600
};

describe('formatTimestamp', () => {
	it('uses m:ss under an hour and h:mm:ss over', () => {
		expect(formatTimestamp(0)).toBe('0:00');
		expect(formatTimestamp(75.9)).toBe('1:15');
		expect(formatTimestamp(3725)).toBe('1:02:05');
	});
});

describe('clipOrigin', () => {
	it('names episodes by series, season and episode', () => {
		expect(clipOrigin(episode)).toBe('Friends T3E7, 5:00–10:00');
	});

	it('falls back to the title when there is no series or numbering', () => {
		expect(clipOrigin({ ...episode, season: null })).toBe('Friends, 5:00–10:00');
		expect(clipOrigin({ ...episode, series: null })).toBe(
			'The One with the Race Car Bed, 5:00–10:00'
		);
	});

	it('names films by title and year', () => {
		expect(
			clipOrigin({
				...episode,
				kind: 'film',
				title: 'Her',
				series: null,
				year: 2013,
				startSec: 3600,
				endSec: 4200
			})
		).toBe('Her (2013), 1:00:00–1:10:00');
	});
});

describe('activeCueIndex', () => {
	const cues = [
		{ start: 0, end: 0.56 },
		{ start: 0.92, end: 1.42 },
		{ start: 1.3, end: 2 },
		{ start: 6, end: 7 }
	];

	it('highlights the phrase being spoken', () => {
		expect(activeCueIndex(cues, 0.3)).toBe(0);
		expect(activeCueIndex(cues, 1)).toBe(1);
	});

	it('keeps it through a short pause instead of blinking off', () => {
		expect(activeCueIndex(cues, 0.7)).toBe(0);
	});

	it('moves on as soon as the next one starts, even if they overlap', () => {
		expect(activeCueIndex(cues, 1.35)).toBe(2);
	});

	it('lets go a moment after the end when nothing follows soon', () => {
		expect(activeCueIndex(cues, 3)).toBe(2);
		expect(activeCueIndex(cues, 3.6)).toBe(-1);
		expect(activeCueIndex(cues, 7.4)).toBe(3);
		expect(activeCueIndex(cues, 9)).toBe(-1);
	});

	it('is -1 before the first phrase or without phrases', () => {
		expect(activeCueIndex(cues.slice(3), 1)).toBe(-1);
		expect(activeCueIndex([], 1)).toBe(-1);
	});
});

describe('cueSpan', () => {
	it('runs until the next phrase starts, to cover speech past the recorded end', () => {
		const cues = [
			{ start: 0.92, end: 1.42 },
			{ start: 2.3, end: 3 }
		];
		expect(cueSpan(cues, 0)).toEqual({ start: 0.72, end: 2.3 });
	});

	it('runs at most a moment past its end when the next phrase is far off or missing', () => {
		expect(
			cueSpan(
				[
					{ start: 1, end: 2 },
					{ start: 10, end: 11 }
				],
				0
			)
		).toEqual({ start: 0.8, end: 3.5 });
		expect(cueSpan([{ start: 1, end: 2 }], 0).end).toBe(3.5);
	});

	it('stops where an overlapping next phrase starts, but lasts at least half a second', () => {
		expect(
			cueSpan(
				[
					{ start: 1, end: 3 },
					{ start: 2, end: 4 }
				],
				0
			).end
		).toBe(2);
		expect(
			cueSpan(
				[
					{ start: 1, end: 1 },
					{ start: 1.1, end: 2 }
				],
				0
			).end
		).toBe(1.5);
	});

	it('never starts before the beginning of the clip', () => {
		expect(cueSpan([{ start: 0.1, end: 1 }], 0).start).toBe(0);
	});
});
