import { createEmptyCard, fsrs, Rating, type Card, type Grade, type State } from 'ts-fsrs';
import type { SrsCard } from './db/schema';

// FSRS with its default parameters, as Anki ships it. Fuzz spreads reviews
// out so words learnt together don't all come back on the same day.
const scheduler = fsrs({ enable_fuzz: true });

export const RATINGS = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const;
export type SrsRating = (typeof RATINGS)[number];

export function isRating(value: unknown): value is SrsRating {
	return RATINGS.includes(value as SrsRating);
}

function fromStored(card: SrsCard | null, now: Date): Card {
	if (!card) return createEmptyCard(now);
	return {
		...card,
		state: card.state as State,
		due: new Date(card.due),
		last_review: card.last_review ? new Date(card.last_review) : undefined
	};
}

function toStored(card: Card): SrsCard {
	return {
		...card,
		due: card.due.toISOString(),
		last_review: card.last_review?.toISOString()
	};
}

/** The word's next state after answering it with `rating` at `now`. */
export function review(
	card: SrsCard | null,
	rating: SrsRating,
	now = new Date()
): { srs: SrsCard; dueAt: Date } {
	const { card: next } = scheduler.next(fromStored(card, now), now, rating as Grade);
	return { srs: toStored(next), dueAt: next.due };
}

/** When each answer would bring the word back, for the buttons' hints. */
export function preview(card: SrsCard | null, now = new Date()): Record<SrsRating, Date> {
	const current = fromStored(card, now);
	return Object.fromEntries(
		RATINGS.map((rating) => [rating, scheduler.next(current, now, rating as Grade).card.due])
	) as Record<SrsRating, Date>;
}
