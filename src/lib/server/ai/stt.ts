import { env } from '$env/dynamic/private';
import type { ClipCue } from '$lib/server/db/schema';
import { serverSentEventData } from '$lib/server/sse';

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

// Long audio (a 10-minute clip) can take minutes on a small CPU-only box.
const LONG_TRANSCRIPTION_TIMEOUT_MS = 30 * 60_000;

type VerboseTranscriptionChunk = {
	language: string;
	segments: { start: number; end: number; text: string }[];
};

/**
 * Like transcribeSpeech, but with per-phrase timings (whisper's segments)
 * for following along with the audio. `language` is whatever whisper
 * detected when none was given.
 *
 * Streamed (`stream=true`, one server-sent event per segment) rather than a
 * single response: Bun's fetch gives up on a connection that has been
 * silent for 300s, whatever the AbortSignal says, and a long clip can take
 * longer than that to transcribe on the production box.
 */
export async function transcribeWithSegments(
	audio: Blob,
	filename: string,
	language?: string | null
): Promise<{ language: string | null; cues: ClipCue[] }> {
	const form = new FormData();
	form.set('file', audio, filename);
	form.set('model', STT_MODEL);
	form.set('response_format', 'verbose_json');
	form.set('stream', 'true');
	if (language) form.set('language', language);

	const response = await fetch(`${STT_BASE_URL}/v1/audio/transcriptions`, {
		method: 'POST',
		body: form,
		signal: AbortSignal.timeout(LONG_TRANSCRIPTION_TIMEOUT_MS)
	});

	if (!response.ok || !response.body) {
		throw new Error(`STT request failed (${response.status}): ${await response.text()}`);
	}

	let detectedLanguage: string | null = language ?? null;
	const cues: ClipCue[] = [];

	for await (const data of serverSentEventData(response.body)) {
		const chunk = JSON.parse(data) as VerboseTranscriptionChunk;
		detectedLanguage ??= chunk.language || null;
		for (const segment of chunk.segments) {
			const text = segment.text.trim();
			if (text) cues.push({ start: segment.start, end: segment.end, text });
		}
	}

	return { language: detectedLanguage, cues };
}
