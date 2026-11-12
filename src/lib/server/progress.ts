import { sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';

/** An IANA zone Intl knows, written only with the characters zone names use. */
export function isTimeZone(zone: string): boolean {
	if (!/^[A-Za-z0-9_+\-/]+$/.test(zone)) return false;
	try {
		new Intl.DateTimeFormat('en', { timeZone: zone });
		return true;
	} catch {
		return false;
	}
}

/**
 * The family's time zone: a day of practice is a day on their clock, not
 * UTC's (otherwise what's done just after midnight in Spain counts for the
 * day before).
 */
export const TIME_ZONE =
	env.APP_TIME_ZONE && isTimeZone(env.APP_TIME_ZONE) ? env.APP_TIME_ZONE : 'Europe/Madrid';

/**
 * The local date of a UTC `timestamp` column, as SQL. The zone goes in as
 * a literal (it's validated above), not a parameter: the same expression
 * in SELECT and GROUP BY would otherwise get two different parameters and
 * Postgres wouldn't see them as one.
 */
export function localDay(column: unknown) {
	return sql<string>`(${localTimestamp(column)})::date`;
}

const ZONE = sql.raw(`'${TIME_ZONE}'`);

/** A UTC `timestamp` column as the family's wall-clock time. */
export function localTimestamp(column: unknown) {
	return sql`(${column} at time zone 'UTC' at time zone ${ZONE})`;
}

/** The family's wall-clock time now. */
export const localNow = sql`(now() at time zone ${ZONE})`;

/** Start (local date, YYYY-MM-DD) of the week (Monday) or month a UTC column falls in. */
export function localPeriodStart(unit: 'week' | 'month', column: unknown) {
	return sql<string>`date_trunc(${sql.raw(`'${unit}'`)}, ${localTimestamp(column)})::date`;
}

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
