function dateKey(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/**
 * Consecutive days of activity up to today. If there's no activity yet
 * today, the streak still counts as unbroken as long as yesterday had
 * activity — the day isn't over yet.
 */
export function computeStreak(activeDates: Set<string>, today = new Date()): number {
	const cursor = new Date(
		Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
	);

	if (!activeDates.has(dateKey(cursor))) {
		cursor.setUTCDate(cursor.getUTCDate() - 1);
	}

	let streak = 0;
	while (activeDates.has(dateKey(cursor))) {
		streak++;
		cursor.setUTCDate(cursor.getUTCDate() - 1);
	}

	return streak;
}
