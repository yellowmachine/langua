import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { englishNameForLanguage } from '$lib/languages';
import { getSeilideAccessToken } from './chat';

const AUDIO_CACHE_DIR = env.AUDIO_CACHE_DIR ?? './data/audio';

// Same model and voice Seilide uses for its own speech. Gemini's voices are
// multilingual: the language comes from the text, steered by the instructions.
const TTS_MODEL = env.TTS_MODEL ?? 'google/gemini-3.8-flash-tts';
const TTS_VOICE = env.TTS_VOICE ?? 'Kore';

function instructionsFor(language?: string | null): string {
	return `Read this aloud in ${englishNameForLanguage(language)} with a native accent, clearly and naturally, at a calm pace for a language learner.`;
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

/**
 * Speech from Seilide's AI endpoint (OpenRouter's TTS, paid for by the
 * user's family), cached on disk by (model, voice, instructions, text) hash
 * so repeated phrases — common in a language-learning app — aren't paid for
 * twice.
 */
export async function synthesizeSpeech(
	userId: string,
	text: string,
	language?: string | null
): Promise<Uint8Array> {
	const instructions = instructionsFor(language);
	const cachePath = cachePathFor(TTS_MODEL, TTS_VOICE, instructions, text);

	try {
		return await readFile(cachePath);
	} catch {
		// not cached yet, fall through to synthesis
	}

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
			voice: TTS_VOICE,
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

	await mkdir(AUDIO_CACHE_DIR, { recursive: true });
	await writeFile(cachePath, audio);

	return audio;
}
