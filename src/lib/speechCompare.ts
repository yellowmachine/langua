import { diffArrays } from 'diff';

export type WordMark = { text: string; said: boolean };

export interface SpeechComparison {
	/** The target sentence word by word, each marked as said or missing. */
	words: WordMark[];
	/** Words said that aren't in the sentence, as transcribed. */
	extra: string[];
	/** 0-100: matched words over target plus extra words. */
	score: number;
}

type Token = { text: string; key: string };

/**
 * Words as they're compared: lower case, no punctuation and no accents, so
 * the transcription's spelling quirks («Qué»/«que», a missing comma) don't
 * count as mistakes — only words said, left out or added.
 */
function tokens(text: string): Token[] {
	return text
		.split(/\s+/)
		.map((word) => ({
			text: word,
			key: word
				.normalize('NFD')
				.replace(/\p{M}/gu, '')
				.toLowerCase()
				.replace(/[^\p{L}\p{N}']/gu, '')
		}))
		.filter((token) => token.key.length > 0);
}

/** Compares what the learner said (transcribed) with the sentence to repeat. */
export function compareSpeech(target: string, said: string): SpeechComparison {
	const expected = tokens(target);
	const heard = tokens(said);
	const changes = diffArrays(expected, heard, { comparator: (a, b) => a.key === b.key });

	const words: WordMark[] = [];
	const extra: string[] = [];
	let next = 0; // index into `expected`
	for (const change of changes) {
		if (change.added) {
			extra.push(...change.value.map((token) => token.text));
		} else {
			// Common or removed: either way these are the target's own words.
			for (let i = 0; i < change.value.length; i++) {
				words.push({ text: expected[next++].text, said: !change.removed });
			}
		}
	}

	const matched = words.filter((word) => word.said).length;
	const total = expected.length + extra.length;
	return { words, extra, score: total === 0 ? 0 : Math.round((100 * matched) / total) };
}
