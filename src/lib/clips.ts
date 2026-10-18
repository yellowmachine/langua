// Display helpers for clips sent in by integrations (see /api/v1/clips).

type ClipSource = {
	kind: 'episode' | 'film';
	title: string;
	series: string | null;
	season: number | null;
	episode: number | null;
	year: number | null;
	startSec: number;
	endSec: number;
};

/** `75` → `1:15`, `3725` → `1:02:05`. */
export function formatTimestamp(totalSeconds: number): string {
	const seconds = Math.max(0, Math.floor(totalSeconds));
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = String(seconds % 60).padStart(2, '0');
	return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Where the clip comes from, e.g. `Friends T3E7` or `Her (2013)`. */
export function clipSourceName(clip: Omit<ClipSource, 'startSec' | 'endSec'>): string {
	if (clip.kind === 'episode' && clip.series) {
		const number =
			clip.season !== null && clip.episode !== null ? ` T${clip.season}E${clip.episode}` : '';
		return `${clip.series}${number}`;
	}
	return clip.year ? `${clip.title} (${clip.year})` : clip.title;
}

/** e.g. `Friends T3E7, 5:00–10:00`. */
export function clipOrigin(clip: ClipSource): string {
	return `${clipSourceName(clip)}, ${formatTimestamp(clip.startSec)}–${formatTimestamp(clip.endSec)}`;
}

// Phrase timings (whisper's word timestamps especially) tend to end a bit
// before the speech does: a phrase is taken to run until the next one starts,
// up to this long past its recorded end — long enough to bridge a pause and
// the tail of the last word, short of lingering through a stretch with no
// speech.
const PHRASE_TAIL_SECONDS = 1.5;
// And to start slightly early, so looping it doesn't clip the first syllable.
const PHRASE_LEAD_SECONDS = 0.2;

type Timed = { start: number; end: number };

/**
 * The stretch of audio a phrase covers, as highlighted and as looped by
 * "Repetir frase": from just before its start until the next phrase
 * starts, but no more than a moment after its own end.
 */
export function cueSpan(cues: Timed[], index: number): { start: number; end: number } {
	const cue = cues[index];
	const next = cues[index + 1];
	const end = Math.max(
		cue.start + 0.5,
		Math.min(next?.start ?? Infinity, cue.end + PHRASE_TAIL_SECONDS)
	);
	return { start: Math.max(0, cue.start - PHRASE_LEAD_SECONDS), end };
}

/**
 * The phrase to highlight at `time`: the last one that has started, for as
 * long as its span (see cueSpan) lasts. -1 if none.
 */
export function activeCueIndex(cues: Timed[], time: number): number {
	let index = -1;
	for (let i = 0; i < cues.length && cues[i].start <= time; i++) index = i;
	if (index === -1) return -1;
	return time < cueSpan(cues, index).end ? index : -1;
}
