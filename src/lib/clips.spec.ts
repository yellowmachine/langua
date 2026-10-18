import { describe, expect, it } from 'vitest';
import { clipOrigin, formatTimestamp } from './clips';

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
