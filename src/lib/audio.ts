import { page } from '$app/state';
import type { SpeechStyle } from '$lib/voices';

export interface SpeechRequest {
	style?: SpeechStyle;
	/** «Repetir despacio». */
	slow?: boolean;
}

// Blob URLs for already-fetched phrases, keyed by their /tts URL, so replaying
// or auto-playing the same phrase in a session doesn't hit /tts again. Kept
// to the most recent ones (a Map iterates in insertion order), releasing the
// audio of the rest.
const audioUrlCache = new Map<string, Promise<string | null>>();
const AUDIO_CACHE_SIZE = 50;

function remember(key: string, pending: Promise<string | null>) {
	audioUrlCache.set(key, pending);
	while (audioUrlCache.size > AUDIO_CACHE_SIZE) {
		const [oldestKey, oldest] = audioUrlCache.entries().next().value!;
		audioUrlCache.delete(oldestKey);
		oldest.then((url) => url && URL.revokeObjectURL(url));
	}
}

/**
 * The /tts URL for `text`, with the signed-in user's voice and accent (Mi
 * cuenta → Voz): changing them changes the URL, so no cache serves the old one.
 */
function speechUrl(text: string, language: string | null | undefined, request: SpeechRequest) {
	const user = page.data.user as { voice?: string | null; accent?: string | null } | undefined;
	const params = new URLSearchParams({ text });
	if (language) params.set('language', language);
	if (user?.voice) params.set('voice', user.voice);
	if (user?.accent) params.set('accent', user.accent);
	// The default left out, so that autoplay and the button share one URL.
	if (request.style && request.style !== 'conversation') params.set('style', request.style);
	if (request.slow) params.set('slow', '1');
	return `/tts?${params}`;
}

/** null when it couldn't be had (offline, /tts failed): never a rejection. */
async function fetchAudioBlobUrl(url: string): Promise<string | null> {
	try {
		const response = await fetch(url);
		if (!response.ok) return null;
		return URL.createObjectURL(await response.blob());
	} catch {
		return null;
	}
}

/** Fetches synthesized speech from /tts as a ready-to-play Audio element. */
export async function fetchSpeechAudio(
	text: string,
	language?: string | null,
	request: SpeechRequest = {}
): Promise<HTMLAudioElement | null> {
	const key = speechUrl(text, language, request);
	let pending = audioUrlCache.get(key);
	if (!pending) {
		pending = fetchAudioBlobUrl(key);
		remember(key, pending);
	}

	const url = await pending;
	if (!url) {
		audioUrlCache.delete(key);
		return null;
	}
	return new Audio(url);
}
