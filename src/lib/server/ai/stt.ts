import { env } from '$env/dynamic/private';

const STT_BASE_URL = env.STT_BASE_URL ?? 'http://stt:8000';
const STT_MODEL = env.STT_MODEL ?? 'Systran/faster-whisper-small';

/**
 * Local faster-whisper-server (see docker/stt), OpenAI-compatible
 * /v1/audio/transcriptions endpoint. Accepts whatever format the browser's
 * MediaRecorder produced (webm/opus in Chrome/Firefox) — the server decodes
 * it with ffmpeg internally.
 */
export async function transcribeSpeech(audio: Blob, language?: string | null): Promise<string> {
	const form = new FormData();
	form.set('file', audio, 'attempt.webm');
	form.set('model', STT_MODEL);
	if (language) form.set('language', language);

	const response = await fetch(`${STT_BASE_URL}/v1/audio/transcriptions`, {
		method: 'POST',
		body: form
	});

	if (!response.ok) {
		throw new Error(`STT request failed (${response.status}): ${await response.text()}`);
	}

	const data = (await response.json()) as { text: string };
	return data.text.trim();
}
