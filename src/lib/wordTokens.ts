export interface WordToken {
	text: string;
	clickable: boolean;
	start: number;
}

/** Splits text into tokens for per-word click handlers, preserving whitespace/punctuation as-is. */
export function splitIntoWords(text: string): WordToken[] {
	const tokens: WordToken[] = [];
	let offset = 0;
	for (const part of text.split(/(\s+|[.,!?;:"«»""''()¿¡—-])/)) {
		if (part.length === 0) continue;
		tokens.push({ text: part, clickable: /\p{L}/u.test(part), start: offset });
		offset += part.length;
	}
	return tokens;
}

/** Returns just the sentence containing the given character offset, not the whole (possibly multi-sentence) text. */
export function sentenceContaining(text: string, offset: number): string {
	for (const match of text.matchAll(/[^.!?]*[.!?]+|[^.!?]+$/g)) {
		if (match.index === undefined) continue;
		const start = match.index;
		const end = start + match[0].length;
		if (offset >= start && offset < end) return match[0].trim();
	}
	return text.trim();
}
