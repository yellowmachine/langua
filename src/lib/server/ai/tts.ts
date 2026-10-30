import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { englishNameForLanguage } from '$lib/languages';
import { accentFor, DEFAULT_VOICE, type SpeechStyle, type VoiceId } from '$lib/voices';
import { getSeilideAccessToken } from './chat';

const AUDIO_CACHE_DIR = env.AUDIO_CACHE_DIR ?? './data/audio';

// Same model Seilide uses for its own speech. Gemini's voices are
// multilingual: the language, accent, tone and pace come from the
// instructions, which are not read aloud.
const TTS_MODEL = env.TTS_MODEL ?? 'google/gemini-3.8-flash-tts';

export interface SpeechOptions {
	language?: string | null;
	voice?: VoiceId | null;
	/** One of the language's in src/lib/voices.ts; another falls back to its default. */
	accent?: string | null;
	style?: SpeechStyle;
	/** «Repetir despacio»: said slowly, every syllable, for a beginner. */
	slow?: boolean;
}

const STYLE_INSTRUCTIONS: Record<SpeechStyle, string> = {
	conversation:
		'Speak it as a friendly native speaker in a relaxed conversation, with natural, expressive intonation.',
	narration:
		'Read it like a clear, neutral recording for a listening-comprehension exercise: even intonation, well-separated sentences.',
	word: 'Say this word or short phrase on its own, carefully, as in a pronunciation dictionary.'
};

export function instructionsFor(options: SpeechOptions): string {
	const accent = accentFor(options.language, options.accent);
	const variety = accent?.description ?? englishNameForLanguage(options.language);
	const pace = options.slow
		? 'Speak slowly, articulating every syllable, with short pauses between phrases, so a beginner can follow every sound, yet still sounding natural, not robotic.'
		: 'Keep a calm, natural pace for a language learner.';
	return `Read this aloud in ${variety}, with a native accent. ${STYLE_INSTRUCTIONS[options.style ?? 'conversation']} ${pace}`;
}

function cachePathFor(model: string, voice: string, instructions: string, text: string): string {
	const hash = createHash('sha256')
		.update(`${model}|${voice}|${instructions}|${text}`)
		.digest('hex');
	return path.join(AUDIO_CACHE_DIR, `${hash}.wav`);
}

/** Raw 16-bit mono PCM (what Gemini's speech models return) as a WAV file. */
export function pcmToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
	const wav = new Uint8Array(44 + pcm.length);
	const view = new DataView(wav.buffer);
	const ascii = (offset: number, text: string) =>
		[...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));

	ascii(0, 'RIFF');
	view.setUint32(4, 36 + pcm.length, true);
	ascii(8, 'WAVE');
	ascii(12, 'fmt ');
	view.setUint32(16, 16, true); // fmt chunk size
	view.setUint16(20, 1, true); // PCM
	view.setUint16(22, 1, true); // mono
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true); // byte rate
	view.setUint16(32, 2, true); // block align
	view.setUint16(34, 16, true); // bits per sample
	ascii(36, 'data');
	view.setUint32(40, pcm.length, true);
	wav.set(pcm, 44);
	return wav;
}

// Phrases being synthesized right now, by cache path: a second request for
// one (a double click, autoplay and the button at once, two users) waits for
// the first instead of paying for it again.
const inFlight = new Map<string, Promise<Uint8Array>>();

/**
 * Speech from Seilide's AI endpoint (OpenRouter's TTS, paid for by the
 * user's family), cached on disk by (model, voice, instructions, text) hash
 * — shared by every user — so repeated phrases, common in a
 * language-learning app, are paid for once.
 */
export async function synthesizeSpeech(
	userId: string,
	text: string,
	options: SpeechOptions = {}
): Promise<Uint8Array> {
	const voice = options.voice ?? DEFAULT_VOICE;
	const instructions = instructionsFor(options);
	const cachePath = cachePathFor(TTS_MODEL, voice, instructions, text);

	try {
		return await readFile(cachePath);
	} catch {
		// not cached yet, fall through to synthesis
	}

	let pending = inFlight.get(cachePath);
	if (!pending) {
		pending = synthesizeToCache(userId, text, voice, instructions, cachePath).finally(() =>
			inFlight.delete(cachePath)
		);
		inFlight.set(cachePath, pending);
	}
	return pending;
}

async function synthesizeToCache(
	userId: string,
	text: string,
	voice: string,
	instructions: string,
	cachePath: string
): Promise<Uint8Array> {
	const accessToken = await getSeilideAccessToken(userId);
	const response = await fetch(`${env.SEILIDE_URL}/api/ia/v1/audio/speech`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
			'X-Title': 'Langua'
		},
		body: JSON.stringify({
			model: TTS_MODEL,
			voice,
			input: text,
			instructions,
			response_format: 'pcm'
		}),
		signal: AbortSignal.timeout(60_000)
	});

	if (!response.ok) {
		const body = await response.json().catch(() => null);
		const message = body?.error?.message ?? `HTTP ${response.status}`;
		console.error(`[tts] Seilide refused speech (${response.status}): ${message}`);
		error(502, `No se ha podido generar la voz: ${message}`);
	}

	// E.g. `audio/pcm;rate=24000;channels=1`.
	const rate = Number(/rate=(\d+)/.exec(response.headers.get('content-type') ?? '')?.[1]) || 24_000;
	const audio = pcmToWav(new Uint8Array(await response.arrayBuffer()), rate);

	// Written aside and renamed into place, so a concurrent read never finds
	// half a file.
	await mkdir(AUDIO_CACHE_DIR, { recursive: true });
	const partial = `${cachePath}.${crypto.randomUUID()}.part`;
	await writeFile(partial, audio);
	await rename(partial, cachePath);

	return audio;
}
