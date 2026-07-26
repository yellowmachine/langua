import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '$env/dynamic/private';

const TTS_BASE_URL = env.TTS_BASE_URL ?? 'http://tts:5000';
const AUDIO_CACHE_DIR = env.AUDIO_CACHE_DIR ?? './data/audio';

// One Piper voice per language in src/lib/languages.ts — see docker/tts.
const VOICE_BY_LANGUAGE: Record<string, string> = {
	es: 'es_ES-davefx-medium',
	en: 'en_US-lessac-medium',
	fr: 'fr_FR-siwis-medium',
	de: 'de_DE-thorsten-medium',
	it: 'it_IT-paola-medium',
	pt: 'pt_BR-faber-medium'
};

const DEFAULT_VOICE = VOICE_BY_LANGUAGE.en;

function voiceForLanguage(language?: string | null): string {
	return (language && VOICE_BY_LANGUAGE[language]) || DEFAULT_VOICE;
}

function cachePathFor(voice: string, text: string): string {
	const hash = createHash('sha256').update(`${voice}|${text}`).digest('hex');
	return path.join(AUDIO_CACHE_DIR, `${hash}.wav`);
}

/**
 * Local Piper TTS (see docker/tts), cached on disk by (voice, text) hash so
 * repeated phrases — common in a language-learning app — don't re-synthesize.
 */
export async function synthesizeSpeech(
	text: string,
	language?: string | null
): Promise<Uint8Array> {
	const voice = voiceForLanguage(language);
	const cachePath = cachePathFor(voice, text);

	try {
		return await readFile(cachePath);
	} catch {
		// not cached yet, fall through to synthesis
	}

	const response = await fetch(`${TTS_BASE_URL}/synthesize`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ text, voice })
	});

	if (!response.ok) {
		throw new Error(`TTS request failed (${response.status}): ${await response.text()}`);
	}

	const audio = new Uint8Array(await response.arrayBuffer());

	await mkdir(AUDIO_CACHE_DIR, { recursive: true });
	await writeFile(cachePath, audio);

	return audio;
}
