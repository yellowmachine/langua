import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { computeStreak, localDateKey, recentDateKeys } = await import('./progress');

// 00:30 on 10 March in Madrid is still 9 March in UTC.
const justAfterMidnightInMadrid = new Date('2026-03-09T23:30:00Z');

describe('localDateKey', () => {
	it("is the family's day, not UTC's", () => {
		expect(localDateKey(justAfterMidnightInMadrid, 'Europe/Madrid')).toBe('2026-03-10');
		expect(localDateKey(justAfterMidnightInMadrid, 'UTC')).toBe('2026-03-09');
	});
});

describe('computeStreak', () => {
	it('counts back from today', () => {
		const days = new Set(['2026-03-08', '2026-03-09', '2026-03-10']);
		expect(computeStreak(days, justAfterMidnightInMadrid, 'Europe/Madrid')).toBe(3);
	});

	it("isn't broken by a today with nothing done yet", () => {
		const days = new Set(['2026-03-08', '2026-03-09']);
		expect(computeStreak(days, justAfterMidnightInMadrid, 'Europe/Madrid')).toBe(2);
	});

	it('is zero after a day off', () => {
		expect(computeStreak(new Set(['2026-03-07']), justAfterMidnightInMadrid, 'Europe/Madrid')).toBe(
			0
		);
	});

	it('crosses month ends', () => {
		const days = new Set(['2026-02-28', '2026-03-01']);
		expect(computeStreak(days, new Date('2026-03-01T10:00:00Z'), 'Europe/Madrid')).toBe(2);
	});
});

describe('recentDateKeys', () => {
	it('lists the last days ending today, oldest first', () => {
		expect(recentDateKeys(3, justAfterMidnightInMadrid, 'Europe/Madrid')).toEqual([
			'2026-03-08',
			'2026-03-09',
			'2026-03-10'
		]);
	});
});
