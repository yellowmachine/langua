export type HighlightType = 'spelling' | 'grammar';

export interface HighlightError {
	fragment: string;
	type: HighlightType;
}

export interface HighlightSegment {
	text: string;
	type: HighlightType | null;
}

/**
 * Splits `text` into segments annotated by the error fragments found within it.
 * Fragments that don't literally appear in `text` (model hallucination) or that
 * overlap an already-matched fragment are skipped.
 */
export function buildHighlightSegments(text: string, errors: HighlightError[]): HighlightSegment[] {
	const matches: { start: number; end: number; type: HighlightType }[] = [];

	for (const err of errors) {
		if (!err.fragment) continue;
		const start = text.indexOf(err.fragment);
		if (start === -1) continue;
		const end = start + err.fragment.length;
		const overlaps = matches.some((m) => start < m.end && end > m.start);
		if (overlaps) continue;
		matches.push({ start, end, type: err.type });
	}

	matches.sort((a, b) => a.start - b.start);

	const segments: HighlightSegment[] = [];
	let cursor = 0;
	for (const match of matches) {
		if (match.start > cursor) {
			segments.push({ text: text.slice(cursor, match.start), type: null });
		}
		segments.push({ text: text.slice(match.start, match.end), type: match.type });
		cursor = match.end;
	}
	if (cursor < text.length) {
		segments.push({ text: text.slice(cursor), type: null });
	}
	return segments;
}
