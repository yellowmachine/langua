import { env } from '$env/dynamic/private';
import type { ClipCue } from '$lib/server/db/schema';
import { serverSentEventData } from '$lib/server/sse';
import { cuesFromWhisperSegment, type WhisperSegment } from './whisper-cues';

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
	segments: WhisperSegment[];
};

/**
 * Like transcribeSpeech, but with per-sentence timings for following along
 * with the audio. `language` is whatever whisper
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
	// Segment timestamps alone are coarse (often whole seconds), which made
	// the highlighted phrase drift from the audio; word timestamps cost
	// about the same and let each sentence be timed from its own words.
	form.append('timestamp_granularities[]', 'word');
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
		for (const segment of chunk.segments) cues.push(...cuesFromWhisperSegment(segment));
	}

	return { language: detectedLanguage, cues };
}
