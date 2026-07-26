import { and, avg, count, eq, gte, sql } from 'drizzle-orm';
import { chatMessage, listeningAttempt } from '$lib/server/db/schema';
import { computeStreak } from '$lib/server/progress';
import type { PageServerLoad } from './$types';

const ACTIVITY_WINDOW_DAYS = 60;
const RECENT_DAYS = 14;

function toAvgScore(value: string | null): number | null {
	return value === null ? null : Math.round(Number(value));
}

export const load: PageServerLoad = async ({ locals }) => {
	const since = new Date();
	since.setUTCDate(since.getUTCDate() - (ACTIVITY_WINDOW_DAYS - 1));
	since.setUTCHours(0, 0, 0, 0);

	const chatDay = sql<string>`date_trunc('day', ${chatMessage.createdAt})::date`;
	const listeningDay = sql<string>`date_trunc('day', ${listeningAttempt.createdAt})::date`;

	const [chatDays, listeningDays, [chatTotal], [listeningAgg]] = await Promise.all([
		locals.withRLS((tx) =>
			tx
				.select({ day: chatDay, count: count() })
				.from(chatMessage)
				.where(and(eq(chatMessage.role, 'user'), gte(chatMessage.createdAt, since)))
				.groupBy(chatDay)
		),
		locals.withRLS((tx) =>
			tx
				.select({ day: listeningDay, count: count() })
				.from(listeningAttempt)
				.where(gte(listeningAttempt.createdAt, since))
				.groupBy(listeningDay)
		),
		locals.withRLS((tx) =>
			tx.select({ count: count() }).from(chatMessage).where(eq(chatMessage.role, 'user'))
		),
		locals.withRLS((tx) =>
			tx.select({ count: count(), avgScore: avg(listeningAttempt.score) }).from(listeningAttempt)
		)
	]);

	const activityByDay = new Map<string, number>();
	for (const rows of [chatDays, listeningDays]) {
		for (const row of rows) {
			activityByDay.set(row.day, (activityByDay.get(row.day) ?? 0) + row.count);
		}
	}

	const streak = computeStreak(new Set(activityByDay.keys()));

	const recentDays = Array.from({ length: RECENT_DAYS }, (_, i) => {
		const day = new Date();
		day.setUTCDate(day.getUTCDate() - (RECENT_DAYS - 1 - i));
		const key = day.toISOString().slice(0, 10);
		return { date: key, count: activityByDay.get(key) ?? 0 };
	});

	return {
		streak,
		recentDays,
		totals: {
			chatMessages: chatTotal?.count ?? 0,
			listeningAttempts: listeningAgg?.count ?? 0,
			listeningAvgScore: toAvgScore(listeningAgg?.avgScore ?? null)
		}
	};
};
