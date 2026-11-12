import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

const getAccessToken = vi.fn();
const cacheDir = await mkdtemp(path.join(tmpdir(), 'langua-tts-'));

vi.mock('$env/dynamic/private', () => ({
	env: { SEILIDE_URL: 'https://seilide.test', AUDIO_CACHE_DIR: cacheDir }
}));
vi.mock('../auth', () => ({ auth: { api: { getAccessToken } } }));

const { instructionsFor, pcmToWav, pruneCache, synthesizeSpeech } = await import('./tts');

function pcm(bytes: number[]) {
	return new Response(new Uint8Array(bytes), {
		headers: { 'Content-Type': 'audio/pcm;rate=16000;channels=1' }
	});
}

afterEach(async () => {
	vi.unstubAllGlobals();
	getAccessToken.mockReset();
	await rm(cacheDir, { recursive: true, force: true });
});

afterAll(() => rm(cacheDir, { recursive: true, force: true }));

describe('pcmToWav', () => {
	it('prepends a 16-bit mono WAV header at the given rate', () => {
		const wav = pcmToWav(new Uint8Array([1, 2, 3, 4]), 24_000);
		const view = new DataView(wav.buffer);

		expect(new TextDecoder().decode(wav.slice(0, 4))).toBe('RIFF');
		expect(new TextDecoder().decode(wav.slice(8, 12))).toBe('WAVE');
		expect(view.getUint32(4, true)).toBe(40);
		expect(view.getUint16(22, true)).toBe(1);
		expect(view.getUint32(24, true)).toBe(24_000);
		expect(view.getUint16(34, true)).toBe(16);
		expect(view.getUint32(40, true)).toBe(4);
		expect([...wav.slice(44)]).toEqual([1, 2, 3, 4]);
	});
});

describe('instructionsFor', () => {
	it("uses the chosen accent, or the language's default for a foreign one", () => {
		expect(instructionsFor({ language: 'es', accent: 'es-AR' })).toContain('Rioplatense');
		expect(instructionsFor({ language: 'es', accent: 'en-GB' })).toContain('Spain');
		expect(instructionsFor({ language: 'pt' })).toContain('Brazilian');
	});

	it('changes tone with the style and pace with slow', () => {
		expect(instructionsFor({ language: 'en', style: 'word' })).toContain('dictionary');
		expect(instructionsFor({ language: 'en', style: 'narration' })).toContain('listening');
		expect(instructionsFor({ language: 'en' })).toContain('conversation');
		expect(instructionsFor({ language: 'en', slow: true })).toContain('syllable');
		expect(instructionsFor({ language: 'en' })).not.toContain('syllable');
	});
});

describe('synthesizeSpeech', () => {
	it("asks Seilide's speech endpoint with the user's token, as a WAV at the returned rate", async () => {
		getAccessToken.mockResolvedValue({ accessToken: 'seilide-token' });
		const fetchMock = vi.fn(async () => pcm([9, 9]));
		vi.stubGlobal('fetch', fetchMock);

		const audio = await synthesizeSpeech('user-1', 'Ciao!', { language: 'it' });

		expect(getAccessToken).toHaveBeenCalledWith({
			body: { providerId: 'seilide', userId: 'user-1' }
		});
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://seilide.test/api/ia/v1/audio/speech');
		expect(new Headers(init.headers).get('authorization')).toBe('Bearer seilide-token');
		expect(new Headers(init.headers).get('x-title')).toBe('Langua');
		const body = JSON.parse(init.body as string);
		expect(body).toMatchObject({ input: 'Ciao!', voice: 'Kore', response_format: 'pcm' });
		expect(body.instructions).toContain('Standard Italian');
		expect(new DataView(audio.buffer).getUint32(24, true)).toBe(16_000);
		expect([...audio.slice(44)]).toEqual([9, 9]);
	});

	it('serves a repeated phrase from the cache without asking again', async () => {
		getAccessToken.mockResolvedValue({ accessToken: 'seilide-token' });
		const fetchMock = vi.fn(async () => pcm([1, 2]));
		vi.stubGlobal('fetch', fetchMock);

		const first = await synthesizeSpeech('user-1', 'Hola', { language: 'es' });
		const second = await synthesizeSpeech('user-2', 'Hola', { language: 'es' });

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect([...second]).toEqual([...first]);
		expect(await readdir(cacheDir)).toHaveLength(1);
	});

	it('asks once for the same phrase requested twice at the same time', async () => {
		getAccessToken.mockResolvedValue({ accessToken: 'seilide-token' });
		const fetchMock = vi.fn(async () => pcm([5, 6]));
		vi.stubGlobal('fetch', fetchMock);

		const [first, second] = await Promise.all([
			synthesizeSpeech('user-1', 'Buongiorno', { language: 'it' }),
			synthesizeSpeech('user-2', 'Buongiorno', { language: 'it' })
		]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect([...second]).toEqual([...first]);
		expect(await readdir(cacheDir)).toEqual([expect.stringMatching(/^[0-9a-f]{64}\.wav$/)]);
	});

	it('caches each voice, accent and pace apart', async () => {
		getAccessToken.mockResolvedValue({ accessToken: 'seilide-token' });
		const fetchMock = vi.fn(async () => pcm([1, 2]));
		vi.stubGlobal('fetch', fetchMock);

		await synthesizeSpeech('user-1', 'Hola', { language: 'es' });
		await synthesizeSpeech('user-1', 'Hola', { language: 'es', voice: 'Puck' });
		await synthesizeSpeech('user-1', 'Hola', { language: 'es', accent: 'es-AR' });
		await synthesizeSpeech('user-1', 'Hola', { language: 'es', slow: true });

		expect(fetchMock).toHaveBeenCalledTimes(4);
		const voices = fetchMock.mock.calls.map(
			(call) => JSON.parse((call as unknown as [string, RequestInit])[1].body as string).voice
		);
		expect(voices).toEqual(['Kore', 'Puck', 'Kore', 'Kore']);
	});

	it("fails with Seilide's reason and caches nothing when it refuses", async () => {
		getAccessToken.mockResolvedValue({ accessToken: 'seilide-token' });
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				Response.json(
					{ error: { message: 'No queda saldo en OpenRouter', code: 402 } },
					{ status: 402 }
				)
			)
		);
		vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(synthesizeSpeech('user-1', 'Hello', { language: 'en' })).rejects.toMatchObject({
			status: 502,
			body: { message: 'No se ha podido generar la voz: No queda saldo en OpenRouter' }
		});
		expect(await readdir(cacheDir).catch(() => [])).toHaveLength(0);
	});

	it("asks again with its own token when someone else's same request failed", async () => {
		getAccessToken.mockImplementation(async ({ body }: { body: { userId: string } }) => ({
			accessToken: `token-${body.userId}`
		}));
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
			(init.headers as Record<string, string>).Authorization === 'Bearer token-broke'
				? Response.json({ error: { message: 'Sin saldo' } }, { status: 402 })
				: pcm([7, 8])
		);
		vi.stubGlobal('fetch', fetchMock);

		const [broke, fine] = await Promise.allSettled([
			synthesizeSpeech('broke', 'Bonjour', { language: 'fr' }),
			synthesizeSpeech('fine', 'Bonjour', { language: 'fr' })
		]);

		expect(broke.status).toBe('rejected');
		expect(fine.status).toBe('fulfilled');
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});

describe('pruneCache', () => {
	it('deletes the least recently played phrases until it fits', async () => {
		await mkdir(cacheDir, { recursive: true });
		const files = ['old', 'middle', 'new'];
		for (const [i, name] of files.entries()) {
			const file = path.join(cacheDir, `${name}.wav`);
			await writeFile(file, new Uint8Array(100));
			const when = new Date(2026, 0, i + 1);
			await utimes(file, when, when);
		}

		await pruneCache(250);

		expect((await readdir(cacheDir)).sort()).toEqual(['middle.wav', 'new.wav']);
	});
});
