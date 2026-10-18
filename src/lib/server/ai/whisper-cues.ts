import type { ClipCue } from '$lib/server/db/schema';

export type WhisperWord = { start: number; end: number; word: string };
export type WhisperSegment = {
	start: number;
	end: number;
	text: string;
	words?: WhisperWord[] | null;
};

// A word that ends a sentence: "doing?", "break.", «Hola!», "Wait…"
const SENTENCE_END = /[.!?…]["'»”’)\]]*$/;

/**
 * Phrases to follow along with, from one whisper segment. A segment can
 * run several sentences long, and its own start/end are coarse (whisper's
 * timestamp tokens, often whole seconds); with word timestamps each
 * sentence gets its own cue, timed from its first and last word.
 */
export function cuesFromWhisperSegment(segment: WhisperSegment): ClipCue[] {
	const words = segment.words ?? [];
	if (words.length === 0) {
		const text = segment.text.trim();
		return text ? [{ start: segment.start, end: segment.end, text }] : [];
	}

	const cues: ClipCue[] = [];
	let current: WhisperWord[] = [];
	const flush = () => {
		const text = current
			.map((w) => w.word)
			.join('')
			.trim();
		if (text) cues.push({ start: current[0].start, end: current[current.length - 1].end, text });
		current = [];
	};

	for (const word of words) {
		current.push(word);
		if (SENTENCE_END.test(word.word.trim())) flush();
	}
	if (current.length > 0) flush();

	return cues;
}
