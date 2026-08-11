// Blob URLs for already-fetched phrases, keyed by language+text, so replaying
// or auto-playing the same phrase in a session doesn't hit /tts again.
const audioUrlCache = new Map<string, Promise<string | null>>();

async function fetchAudioBlobUrl(text: string, language?: string | null): Promise<string | null> {
	const params = new URLSearchParams({ text });
	if (language) params.set('language', language);

	const response = await fetch(`/tts?${params}`);
	if (!response.ok) return null;

	const blob = await response.blob();
	return URL.createObjectURL(blob);
}

/** Fetches synthesized speech from /tts as a ready-to-play Audio element. */
export async function fetchSpeechAudio(
	text: string,
	language?: string | null
): Promise<HTMLAudioElement | null> {
	const key = `${language ?? ''}::${text}`;
	let pending = audioUrlCache.get(key);
	if (!pending) {
		pending = fetchAudioBlobUrl(text, language);
		audioUrlCache.set(key, pending);
	}

	const url = await pending;
	if (!url) {
		audioUrlCache.delete(key);
		return null;
	}
	return new Audio(url);
}
