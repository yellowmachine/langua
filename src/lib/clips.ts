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
