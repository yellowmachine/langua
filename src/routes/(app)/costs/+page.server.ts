import { count, desc, sql, type SQL } from 'drizzle-orm';
import { aiUsage } from '$lib/server/db/schema';
import { localNow, localPeriodStart, localTimestamp } from '$lib/server/progress';
import type { PageServerLoad } from './$types';

const PERIODS = {
	week: 'Esta semana',
	month: 'Este mes',
	quarter: 'Últimos 3 meses',
	all: 'Desde el principio'
} as const;
type Period = keyof typeof PERIODS;

const WEEKS_SHOWN = 12;
const MONTHS_SHOWN = 12;

const local = localTimestamp(aiUsage.createdAt);

/** Rows of the period, by the family's calendar (weeks start on Monday). */
function since(period: Period): SQL | undefined {
	switch (period) {
		case 'week':
			return sql`${local} >= date_trunc('week', ${localNow})`;
		case 'month':
			return sql`${local} >= date_trunc('month', ${localNow})`;
		case 'quarter':
			return sql`${local} >= date_trunc('month', ${localNow}) - interval '2 months'`;
		case 'all':
			return undefined;
	}
}

const cost = sql<string>`coalesce(sum(${aiUsage.costUsd}), 0)`;
const estimated = sql<boolean>`coalesce(bool_or(${aiUsage.costIsEstimate}), false)`;
const unknown = sql<number>`count(*) filter (where ${aiUsage.costUsd} is null)::int`;

function totals(period: Period) {
	return { cost, calls: count(), estimated, unknown, period: sql<string>`${period}` };
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const requested = url.searchParams.get('periodo');
	const period: Period = requested && requested in PERIODS ? (requested as Period) : 'month';

	const week = localPeriodStart('week', aiUsage.createdAt);
	const month = localPeriodStart('month', aiUsage.createdAt);

	const result = await locals.withRLS(async (tx) => {
		const summary = await Promise.all(
			(['week', 'month', 'all'] as const).map((p) =>
				tx
					.select(totals(p))
					.from(aiUsage)
					.where(since(p))
					.then((rows) => rows[0])
			)
		);

		const byTask = await tx
			.select({
				task: aiUsage.task,
				cost,
				calls: count(),
				tokens: sql<number>`coalesce(sum(${aiUsage.inputTokens} + ${aiUsage.outputTokens}), 0)::int`,
				characters: sql<number>`coalesce(sum(${aiUsage.characters}), 0)::int`,
				estimated,
				unknown
			})
			.from(aiUsage)
			.where(since(period))
			.groupBy(aiUsage.task)
			.orderBy(desc(cost), desc(count()));

		const byWeek = await tx
			.select({ start: week, cost, calls: count(), estimated })
			.from(aiUsage)
			.where(
				sql`${local} >= date_trunc('week', ${localNow}) - ${sql.raw(`interval '${WEEKS_SHOWN - 1} weeks'`)}`
			)
			.groupBy(week)
			.orderBy(week);

		const byMonth = await tx
			.select({ start: month, cost, calls: count(), estimated })
			.from(aiUsage)
			.where(
				sql`${local} >= date_trunc('month', ${localNow}) - ${sql.raw(`interval '${MONTHS_SHOWN - 1} months'`)}`
			)
			.groupBy(month)
			.orderBy(desc(month));

		const [{ monday }] = await tx
			.select({ monday: sql<string>`date_trunc('week', ${localNow})::date` })
			.from(sql`(select 1) as one`);

		return { summary, byTask, byWeek, byMonth, monday };
	});

	const toNumber = <T extends { cost: string }>(row: T) => ({ ...row, cost: Number(row.cost) });
	const [thisWeek, thisMonth, allTime] = result.summary.map(toNumber);

	return {
		period,
		periods: PERIODS,
		thisWeek,
		thisMonth,
		allTime,
		byTask: result.byTask.map(toNumber),
		byWeek: fillWeeks(result.byWeek.map(toNumber), result.monday),
		byMonth: result.byMonth.map(toNumber)
	};
};

/** The last WEEKS_SHOWN weeks up to `monday` (this week's), oldest first, empty ones as zero. */
function fillWeeks(
	rows: { start: string; cost: number; calls: number; estimated: boolean }[],
	monday: string
) {
	const byStart = new Map(rows.map((row) => [row.start, row]));
	return Array.from({ length: WEEKS_SHOWN }, (_, i) => {
		const start = new Date(`${monday}T12:00:00Z`);
		start.setUTCDate(start.getUTCDate() - 7 * (WEEKS_SHOWN - 1 - i));
		const key = start.toISOString().slice(0, 10);
		return byStart.get(key) ?? { start: key, cost: 0, calls: 0, estimated: false };
	});
}
