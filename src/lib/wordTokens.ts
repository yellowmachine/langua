/** Splits text into tokens for per-word click handlers, preserving whitespace/punctuation as-is. */
export function splitIntoWords(text: string): { text: string; clickable: boolean }[] {
	return text
		.split(/(\s+|[.,!?;:"«»""''()¿¡—-])/)
		.filter((token) => token.length > 0)
		.map((token) => ({ text: token, clickable: /\p{L}/u.test(token) }));
}
