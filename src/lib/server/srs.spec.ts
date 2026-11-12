import { describe, expect, it } from 'vitest';
import { Rating } from 'ts-fsrs';
import { isRating, preview, review } from './srs';

const now = new Date('2026-11-12T10:00:00Z');

describe('review', () => {
	it('brings a new word back sooner when forgotten than when known', () => {
		const again = review(null, Rating.Again, now);
		const easy = review(null, Rating.Easy, now);
		expect(again.dueAt.getTime()).toBeLessThan(easy.dueAt.getTime());
		expect(easy.dueAt.getTime() - now.getTime()).toBeGreaterThan(24 * 3600_000);
	});

	it('keeps state between reviews as JSON and spaces good answers further out', () => {
		const first = review(null, Rating.Good, now);
		const stored = JSON.parse(JSON.stringify(first.srs));
		const second = review(stored, Rating.Good, first.dueAt);
		const third = review(second.srs, Rating.Good, second.dueAt);
		const gap = (a: Date, b: Date) => b.getTime() - a.getTime();
		expect(gap(second.dueAt, third.dueAt)).toBeGreaterThan(gap(first.dueAt, second.dueAt));
		expect(third.srs.reps).toBe(3);
	});
});

describe('preview', () => {
	it('orders the four answers from soonest to latest', () => {
		const due = preview(null, now);
		const times = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map((r) =>
			due[r].getTime()
		);
		expect([...times].sort((a, b) => a - b)).toEqual(times);
	});
});

describe('isRating', () => {
	it('accepts only the four answers', () => {
		expect([1, 2, 3, 4].every(isRating)).toBe(true);
		expect([0, 5, '3', null].some(isRating)).toBe(false);
	});
});
