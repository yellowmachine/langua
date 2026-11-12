import { and, avg, count, eq, gte, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import {
	chatMessage,
	listeningAttempt,
	speakingAttempt,
	vocabItem,
	vocabReview
} from '$lib/server/db/schema';
import { computeStreak, localDay, recentDateKeys } from '$lib/server/progress';
import type { Tx } from '$lib/server/db';
import type { PageServerLoad } from './$types';

const ACTIVITY_WINDOW_DAYS = 60;
const RECENT_DAYS = 14;

/** Everything that counts as practice, each with the timestamp that dates it. */
const ACTIVITIES = {
	chat: { table: chatMessage, at: chatMessage.createdAt, where: eq(chatMessage.role, 'user') },
	listening: { table: listeningAttempt, at: listeningAttempt.createdAt },
	speaking: { table: speakingAttempt, at: speakingAttempt.createdAt },
	reviews: { table: vocabReview, at: vocabReview.reviewedAt },
	newWords: { table: vocabItem, at: vocabItem.createdAt }
} satisfies Record<string, { table: PgTable; at: PgColumn; where?: SQL }>;

type Activity = keyof typeof ACTIVITIES;

function toAvgScore(value: string | null): number | null {
	return value === null ? null : Math.round(Number(value));
}

/** Per local day (the family's time zone), since `since`. */
function perDay(tx: Tx, activity: Activity, since: Date) {
	const { table, at, where } = ACTIVITIES[activity] as {
		table: PgTable;
		at: PgColumn;
		where?: SQL;
	};
	const day = localDay(at);
	return tx
		.select({ day, count: count() })
		.from(table)
		.where(and(gte(at, since), where))
		.groupBy(day);
}

function total(tx: Tx, activity: Activity) {
	const { table, where } = ACTIVITIES[activity] as { table: PgTable; where?: SQL };
	return tx.select({ count: count() }).from(table).where(where);
}

export const load: PageServerLoad = async ({ locals }) => {
	const since = new Date();
	since.setUTCDate(since.getUTCDate() - (ACTIVITY_WINDOW_DAYS + 1));

	const activities = Object.keys(ACTIVITIES) as Activity[];
	const { days, totals, listeningAvg, speakingAvg } = await locals.withRLS(async (tx) => {
		const days = await Promise.all(activities.map((a) => perDay(tx, a, since)));
		const totals = await Promise.all(activities.map((a) => total(tx, a)));
		const [listeningAvg] = await tx
			.select({ value: avg(listeningAttempt.score) })
			.from(listeningAttempt);
		const [speakingAvg] = await tx
			.select({ value: avg(speakingAttempt.score) })
			.from(speakingAttempt);
		return { days, totals, listeningAvg, speakingAvg };
	});

	// day → activity → count
	const byDay = new Map<string, Record<Activity, number>>();
	activities.forEach((activity, i) => {
		for (const row of days[i]) {
			const entry =
				byDay.get(row.day) ??
				(Object.fromEntries(activities.map((a) => [a, 0])) as Record<Activity, number>);
			entry[activity] += row.count;
			byDay.set(row.day, entry);
		}
	});

	const streak = computeStreak(new Set(byDay.keys()));
	const recentDays = recentDateKeys(RECENT_DAYS).map((date) => {
		const counts =
			byDay.get(date) ??
			(Object.fromEntries(activities.map((a) => [a, 0])) as Record<Activity, number>);
		return { date, counts, count: Object.values(counts).reduce((sum, n) => sum + n, 0) };
	});

	return {
		streak,
		recentDays,
		totals: Object.fromEntries(activities.map((a, i) => [a, totals[i][0]?.count ?? 0])) as Record<
			Activity,
			number
		>,
		averages: {
			listening: toAvgScore(listeningAvg?.value ?? null),
			speaking: toAvgScore(speakingAvg?.value ?? null)
		}
	};
};
