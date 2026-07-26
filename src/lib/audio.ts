/** Fetches synthesized speech from /tts as a ready-to-play Audio element. */
export async function fetchSpeechAudio(
	text: string,
	language?: string | null
): Promise<HTMLAudioElement | null> {
	const response = await fetch('/tts', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ text, language })
	});
	if (!response.ok) return null;

	const blob = await response.blob();
	return new Audio(URL.createObjectURL(blob));
}
