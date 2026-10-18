import { describe, expect, it } from 'vitest';
import { looksLikeMp4, parseClipMetadata, planClipTranscript, type ClipMetadata } from './clips';

const base = {
	source: 'jellycartoon',
	kind: 'episode',
	title: 'The One with the Race Car Bed',
	series: 'Friends',
	season: 3,
	episode: 7,
	year: null,
	startSec: 300,
	endSec: 600,
	language: 'eng',
	transcript: 'How you doin?\nPivot!',
	transcriptLanguage: 'eng',
	cues: [
		{ start: 5, end: 6, text: 'Pivot!' },
		{ start: 1, end: 4, text: 'How you doin?' }
	],
	capturedAt: '2026-10-18T08:44:26.596Z'
};

function parsed(overrides: Record<string, unknown> = {}): ClipMetadata {
	const result = parseClipMetadata(JSON.stringify({ ...base, ...overrides }));
	if (!result.ok) throw new Error(result.message);
	return result.metadata;
}

describe('parseClipMetadata', () => {
	it('accepts the contract example', () => {
		expect(parsed()).toMatchObject({ title: base.title, season: 3, startSec: 300 });
	});

	it('explains what is wrong in short Spanish', () => {
		expect(parseClipMetadata(undefined)).toEqual({
			ok: false,
			message: 'Faltan los datos del clip.'
		});
		expect(parseClipMetadata('{nope')).toEqual({
			ok: false,
			message: 'Los datos del clip no se pueden leer.'
		});
		expect(parseClipMetadata(JSON.stringify({ ...base, endSec: 200 }))).toEqual({
			ok: false,
			message: 'El tramo del clip no es válido.'
		});
		expect(parseClipMetadata(JSON.stringify({ ...base, kind: 'song' }))).toEqual({
			ok: false,
			message: 'Los datos del clip no son válidos (kind).'
		});
	});
});

describe('planClipTranscript', () => {
	it('keeps matching subtitles, with cues sorted', () => {
		expect(planClipTranscript(parsed())).toEqual({
			language: 'en',
			transcript: 'How you doin?\nPivot!',
			cues: [
				{ start: 1, end: 4, text: 'How you doin?' },
				{ start: 5, end: 6, text: 'Pivot!' }
			],
			translation: null,
			needsTranscription: false
		});
	});

	it('treats B and T codes of the same language as matching', () => {
		const plan = planClipTranscript(parsed({ language: 'ger', transcriptLanguage: 'deu' }));
		expect(plan).toMatchObject({ language: 'de', needsTranscription: false });
	});

	it('transcribes when there are no subtitles', () => {
		expect(planClipTranscript(parsed({ transcript: null, cues: [] }))).toEqual({
			language: 'en',
			transcript: null,
			cues: [],
			translation: null,
			needsTranscription: true
		});
	});

	it('transcribes when subtitles are in another language, keeping them as a translation', () => {
		expect(planClipTranscript(parsed({ transcriptLanguage: 'spa' }))).toEqual({
			language: 'en',
			transcript: null,
			cues: [],
			translation: {
				language: 'es',
				cues: [
					{ start: 1, end: 4, text: 'How you doin?' },
					{ start: 5, end: 6, text: 'Pivot!' }
				]
			},
			needsTranscription: true
		});
	});

	it('transcribes when the audio language is unknown, keeping the subtitles as a translation', () => {
		const plan = planClipTranscript(parsed({ language: 'und', transcriptLanguage: 'fre' }));
		expect(plan).toMatchObject({
			language: null,
			transcript: null,
			translation: { language: 'fr' },
			needsTranscription: true
		});
	});

	it('trusts subtitles without a language tag on audio whose language is known', () => {
		const plan = planClipTranscript(parsed({ transcriptLanguage: null }));
		expect(plan).toMatchObject({ language: 'en', translation: null, needsTranscription: false });
	});

	it('transcribes subtitles without timings and does not keep them', () => {
		const plan = planClipTranscript(parsed({ cues: [] }));
		expect(plan).toMatchObject({ transcript: null, translation: null, needsTranscription: true });
	});

	it('keeps an unsupported language as null but still compares it', () => {
		expect(
			planClipTranscript(parsed({ language: 'jpn', transcriptLanguage: 'jpn' }))
		).toMatchObject({ language: null, needsTranscription: false });
		expect(
			planClipTranscript(parsed({ language: 'jpn', transcriptLanguage: 'eng' }))
		).toMatchObject({ language: null, translation: { language: 'en' }, needsTranscription: true });
	});

	it('derives the transcript from the cues and drops empty or out-of-range ones', () => {
		const plan = planClipTranscript(
			parsed({
				transcript: null,
				cues: [
					{ start: 1, end: 2, text: '  Hi  ' },
					{ start: 3, end: 4, text: ' ' },
					{ start: 290, end: 400, text: 'Bye' }
				]
			})
		);
		expect(plan).toMatchObject({
			transcript: 'Hi\nBye',
			cues: [
				{ start: 1, end: 2, text: 'Hi' },
				{ start: 290, end: 300, text: 'Bye' }
			],
			needsTranscription: false
		});
	});
});

describe('looksLikeMp4', () => {
	it('recognises the ftyp box', async () => {
		const mp4 = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41]);
		expect(await looksLikeMp4(new Blob([mp4]))).toBe(true);
		expect(await looksLikeMp4(new Blob(['RIFF....WAVE']))).toBe(false);
	});
});
