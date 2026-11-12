import { env } from '$env/dynamic/private';

/**
 * The family's time zone: a day of practice is a day on their clock, not
 * UTC's (otherwise what's done just after midnight in Spain counts for the
 * day before).
 */
export const TIME_ZONE = env.APP_TIME_ZONE || 'Europe/Madrid';

/** `YYYY-MM-DD` of `date` in `timeZone`. */
export function localDateKey(date: Date, timeZone = TIME_ZONE): string {
	// en-CA formats dates as YYYY-MM-DD.
	return new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(date);
}

/** The day before a `YYYY-MM-DD` key. */
function previousDay(key: string): string {
	const day = new Date(`${key}T12:00:00Z`);
	day.setUTCDate(day.getUTCDate() - 1);
	return day.toISOString().slice(0, 10);
}

/**
 * Consecutive days of activity (as local `YYYY-MM-DD` keys) up to today. If
 * there's no activity yet today, the streak still counts as unbroken as long
 * as yesterday had activity — the day isn't over yet.
 */
export function computeStreak(
	activeDates: Set<string>,
	today = new Date(),
	timeZone = TIME_ZONE
): number {
	let cursor = localDateKey(today, timeZone);
	if (!activeDates.has(cursor)) cursor = previousDay(cursor);

	let streak = 0;
	while (activeDates.has(cursor)) {
		streak++;
		cursor = previousDay(cursor);
	}
	return streak;
}

/** The last `days` local days, oldest first, ending today. */
export function recentDateKeys(days: number, today = new Date(), timeZone = TIME_ZONE): string[] {
	const keys = [localDateKey(today, timeZone)];
	while (keys.length < days) keys.unshift(previousDay(keys[0]));
	return keys;
}
